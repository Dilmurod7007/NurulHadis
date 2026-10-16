from django.db import transaction
from django.db.models import Count, Sum
from rest_framework import serializers

from .models import (
    Buyurtma, BuyurtmaBonus, BuyurtmaQator, Mahsulot, Mijoz, OmborHarakat, OmborTovar, Tarkib, Xarajat,
)


def foyda_korsin(serializer):
    request = serializer.context.get("request")
    return bool(request and request.user.has_perm("crm.view_foyda"))


class MijozSerializer(serializers.ModelSerializer):
    buyurtma_soni = serializers.SerializerMethodField()
    jami_summa = serializers.SerializerMethodField()

    class Meta:
        model = Mijoz
        fields = ["id", "ism", "telefon", "username", "manzil", "izoh", "buyurtma_soni", "jami_summa"]

    def get_buyurtma_soni(self, o):
        return len(o.buyurtmalar.all())

    def get_jami_summa(self, o):
        return sum(b.tushum for b in o.buyurtmalar.all())

    def to_representation(self, o):
        d = super().to_representation(o)
        if not foyda_korsin(self):
            d.pop("jami_summa", None)
        return d


class TarkibSerializer(serializers.ModelSerializer):
    tovar_nom = serializers.CharField(source="tovar.nom", read_only=True)

    class Meta:
        model = Tarkib
        fields = ["id", "tovar", "tovar_nom", "miqdor"]


class MahsulotSerializer(serializers.ModelSerializer):
    tarkib = TarkibSerializer(many=True, required=False)

    class Meta:
        model = Mahsulot
        fields = ["id", "nom", "narx", "tannarx", "faol", "tarkib"]

    def to_representation(self, o):
        d = super().to_representation(o)
        if not foyda_korsin(self):
            d.pop("tannarx", None)
            d.pop("tarkib", None)
        return d

    @transaction.atomic
    def create(self, data):
        tarkib = data.pop("tarkib", [])
        m = Mahsulot.objects.create(**data)
        for t in tarkib:
            Tarkib.objects.create(mahsulot=m, **t)
        return m

    @transaction.atomic
    def update(self, m, data):
        tarkib = data.pop("tarkib", None)
        for k, v in data.items():
            setattr(m, k, v)
        m.save()
        if tarkib is not None:
            m.tarkib.all().delete()
            for t in tarkib:
                Tarkib.objects.create(mahsulot=m, **t)
        return m


class OmborTovarSerializer(serializers.ModelSerializer):
    qoldiq = serializers.IntegerField(read_only=True)
    kam = serializers.BooleanField(read_only=True)

    class Meta:
        model = OmborTovar
        fields = ["id", "nom", "birlik", "min_qoldiq", "qoldiq", "kam"]


class OmborHarakatSerializer(serializers.ModelSerializer):
    tovar_nom = serializers.CharField(source="tovar.nom", read_only=True)
    turi_nom = serializers.CharField(source="get_turi_display", read_only=True)

    class Meta:
        model = OmborHarakat
        fields = ["id", "tovar", "tovar_nom", "turi", "turi_nom", "miqdor", "birlik_narx",
                  "sana", "izoh", "buyurtma"]
        read_only_fields = ["buyurtma"]

    def validate(self, d):
        if d.get("turi") == "chiqim":
            raise serializers.ValidationError("Chiqim buyurtma orqali avtomatik yoziladi.")
        if d.get("turi") == "kirim" and d.get("miqdor", 0) <= 0:
            raise serializers.ValidationError("Kirim miqdori musbat bo'lishi kerak.")
        return d


class XarajatSerializer(serializers.ModelSerializer):
    kategoriya_nom = serializers.CharField(source="get_kategoriya_display", read_only=True)

    class Meta:
        model = Xarajat
        fields = ["id", "sana", "kategoriya", "kategoriya_nom", "summa", "kampaniya", "izoh"]


class QatorSerializer(serializers.ModelSerializer):
    mahsulot_nom = serializers.CharField(source="mahsulot.nom", read_only=True)
    id = serializers.IntegerField(required=False)

    class Meta:
        model = BuyurtmaQator
        fields = ["id", "mahsulot", "mahsulot_nom", "miqdor", "narx"]


class BonusSerializer(serializers.ModelSerializer):
    class Meta:
        model = BuyurtmaBonus
        fields = ["nom", "tannarx"]


class BuyurtmaSerializer(serializers.ModelSerializer):
    qatorlar = QatorSerializer(many=True)
    bonuslar = BonusSerializer(many=True, required=False)
    mijoz_nom = serializers.CharField(source="mijoz.ism", read_only=True)
    mijoz_telefon = serializers.CharField(source="mijoz.telefon", read_only=True)
    tur_nom = serializers.CharField(source="get_tur_display", read_only=True)
    holat_nom = serializers.CharField(source="get_holat_display", read_only=True)
    manba_nom = serializers.CharField(source="get_manba_display", read_only=True)
    yetkazish_turi_nom = serializers.CharField(source="get_yetkazish_turi_display", read_only=True)
    dona = serializers.IntegerField(read_only=True)
    mahsulot_summasi = serializers.IntegerField(read_only=True)
    chegirma_hisob = serializers.IntegerField(read_only=True)
    tushum = serializers.IntegerField(read_only=True)
    tannarx_jami = serializers.IntegerField(read_only=True)
    bonus_tannarxi = serializers.IntegerField(read_only=True)
    foyda = serializers.IntegerField(read_only=True)
    qarz = serializers.IntegerField(read_only=True)
    tolov_holati = serializers.CharField(read_only=True)

    class Meta:
        model = Buyurtma
        fields = [
            "id", "sana", "mijoz", "mijoz_nom", "mijoz_telefon", "tur", "tur_nom", "holat", "holat_nom",
            "manba", "manba_nom", "kampaniya", "chegirma", "chegirma_izoh",
            "yetkazish_turi", "yetkazish_turi_nom", "yetkazish_xarajati", "tolov_usuli", "tolangan", "izoh",
            "qatorlar", "bonuslar",
            "dona", "mahsulot_summasi", "chegirma_hisob", "tushum", "tannarx_jami",
            "bonus_tannarxi", "foyda", "qarz", "tolov_holati",
        ]

    def to_representation(self, o):
        d = super().to_representation(o)
        if not foyda_korsin(self):
            for k in ("tannarx_jami", "bonus_tannarxi", "foyda", "yetkazish_xarajati"):
                d.pop(k, None)
            for bn in d.get("bonuslar", []):
                bn.pop("tannarx", None)
        return d

    def _qatorlarni_yoz(self, b, qatorlar):
        mavjud = {q.id: q for q in b.qatorlar.all()}
        qolgan = set()
        for q in qatorlar:
            qid = q.pop("id", None)
            if qid and qid in mavjud:
                obj = mavjud[qid]
                for k, v in q.items():
                    setattr(obj, k, v)
                obj.save()
                qolgan.add(qid)
            else:
                BuyurtmaQator.objects.create(buyurtma=b, **q)
        for qid, obj in mavjud.items():
            if qid not in qolgan:
                obj.delete()
        # prefetch keshi eskirdi: hisob-kitob yangi qatorlardan olinsin
        getattr(b, "_prefetched_objects_cache", {}).pop("qatorlar", None)

    def _bonuslarni_yoz(self, b, bonuslar):
        if bonuslar is None:
            return
        b.bonuslar.all().delete()
        for bn in bonuslar:
            if not str(bn.get("nom", "")).strip():
                continue
            tannarx = bn.get("tannarx", 0) if foyda_korsin(self) else 0
            BuyurtmaBonus.objects.create(buyurtma=b, nom=bn["nom"].strip(), tannarx=tannarx)
        getattr(b, "_prefetched_objects_cache", {}).pop("bonuslar", None)

    def _bonuslarni_yoz_saqlab(self, b, bonuslar):
        b.bonuslar.all().delete()
        for bn in bonuslar:
            if str(bn.get("nom", "")).strip():
                BuyurtmaBonus.objects.create(buyurtma=b, nom=bn["nom"].strip(), tannarx=bn.get("tannarx", 0))
        getattr(b, "_prefetched_objects_cache", {}).pop("bonuslar", None)

    def _huquq(self, data):
        if not foyda_korsin(self):
            data.pop("yetkazish_xarajati", None)

    @transaction.atomic
    def create(self, data):
        qatorlar = data.pop("qatorlar")
        bonuslar = data.pop("bonuslar", None)
        self._huquq(data)
        b = Buyurtma.objects.create(**data)
        self._qatorlarni_yoz(b, qatorlar)
        self._bonuslarni_yoz(b, bonuslar)
        b.omborni_yangilash()
        return b

    @transaction.atomic
    def update(self, b, data):
        qatorlar = data.pop("qatorlar", None)
        bonuslar = data.pop("bonuslar", None)
        self._huquq(data)
        for k, v in data.items():
            setattr(b, k, v)
        b.save()
        if qatorlar is not None:
            self._qatorlarni_yoz(b, qatorlar)
        if bonuslar is not None and not foyda_korsin(self):
            # yordamchi bonus tannarxini ko'rmaydi: mavjud tannarxlarni saqlab qolamiz
            eski = {x.nom: x.tannarx for x in b.bonuslar.all()}
            for bn in bonuslar:
                bn["tannarx"] = eski.get(bn.get("nom", ""), 0)
            self._bonuslarni_yoz_saqlab(b, bonuslar)
        else:
            self._bonuslarni_yoz(b, bonuslar)
        b.omborni_yangilash()
        return b

    def validate_qatorlar(self, v):
        if not v:
            raise serializers.ValidationError("Kamida bitta mahsulot qo'shing.")
        return v
