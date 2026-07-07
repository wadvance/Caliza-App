import enum
from datetime import datetime


class SampleStatus(str, enum.Enum):
    PENDIENTE = "pendiente"
    VALIDADO = "validado"
    DESCATADO = "descartado"


class AcidReaction(str, enum.Enum):
    VIGOROSA = "vigorosa"
    MODERADA = "moderada"
    LEVE = "leve"
    NULA = "nula"


class RockType(str, enum.Enum):
    CALIZA = "caliza"
    DOLOMITA = "dolomita"
    ARCILLA = "arcilla"
    YESO = "yeso"
    GRANITO = "granito"
    BASALTO = "basalto"
    MARGA = "marga"
    TRAVERTINO = "travertino"
    CALICHE = "caliche"
    DESCONOCIDO = "desconocido"


# Firestore collection names
COLLECTION_SAMPLES = "samples"
COLLECTION_USERS = "users"
COLLECTION_ZONES = "calizaZones"
COLLECTION_OBSERVATIONS = "fieldObservations"
COLLECTION_SATELLITE = "satelliteAnalyses"
COLLECTION_SYNC_LOGS = "syncLogs"
COLLECTION_REPORTS = "explorationReports"
