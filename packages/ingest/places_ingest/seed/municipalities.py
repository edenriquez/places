"""Municipios del corredor A (Morelos / Edomex sur), Puebla y las alcaldías de la Ciudad de México. Códigos INEGI verificados contra el DENUE 05/2026.

Centroides = plaza principal de la cabecera (aprox.). Los polígonos se pueden cargar después desde
el Marco Geoestadístico de INEGI; el MVP funciona con centroides.
"""

from __future__ import annotations

from ..db import connect, execute

# cvegeo, cve_ent, cve_mun, estado, nombre, lat, lng, pueblo_magico, desde_cdmx, población aprox (Censo 2020)
CORRIDOR = [
    ("17020", "17", "020", "Morelos", "Tepoztlán", 18.9853, -99.0997, True, "1 h 30", 54987),
    ("17026", "17", "026", "Morelos", "Tlayacapan", 18.9558, -98.9808, True, "1 h 40", 20081),
    ("17029", "17", "029", "Morelos", "Yautepec", 18.8828, -99.0668, False, "1 h 45", 105780),
    ("17006", "17", "006", "Morelos", "Cuautla", 18.8123, -98.9545, False, "1 h 50", 187118),
    ("17022", "17", "022", "Morelos", "Tetela del Volcán", 18.8930, -98.7295, False, "2 h 20", 22309),
    ("17027", "17", "027", "Morelos", "Totolapan", 18.9880, -98.9198, False, "1 h 45", 12447),
    ("17002", "17", "002", "Morelos", "Atlatlahucan", 18.9350, -98.8967, False, "1 h 40", 24029),
    ("17007", "17", "007", "Morelos", "Cuernavaca", 18.9242, -99.2216, False, "1 h 20", 378476),
    ("15052", "15", "052", "Estado de México", "Malinalco", 18.9490, -99.4949, True, "2 h 10", 27482),
    ("15088", "15", "088", "Estado de México", "Tenancingo", 18.9608, -99.5906, False, "2 h 00", 106891),
    ("15063", "15", "063", "Estado de México", "Ocuilan", 18.9790, -99.4166, False, "2 h 00", 34485),
    # Corredor volcanes (Amecameca y alrededores), Estado de México
    ("15009", "15", "009", "Estado de México", "Amecameca", 19.1236, -98.7664, False, "1 h 15", 53441),
    ("15068", "15", "068", "Estado de México", "Ozumba", 19.0392, -98.7936, False, "1 h 25", 30785),
    ("15094", "15", "094", "Estado de México", "Tepetlixpa", 19.0000, -98.8167, False, "1 h 30", 20500),
    ("15017", "15", "017", "Estado de México", "Ayapango", 19.1264, -98.8033, False, "1 h 15", 10053),
    ("15103", "15", "103", "Estado de México", "Tlalmanalco", 19.2044, -98.8025, False, "1 h 10", 47390),
    ("15015", "15", "015", "Estado de México", "Atlautla", 19.0167, -98.7667, False, "1 h 30", 31900),
    ("15034", "15", "034", "Estado de México", "Ecatzingo", 18.9522, -98.7503, False, "1 h 40", 10827),
    ("15050", "15", "050", "Estado de México", "Juchitepec", 19.1000, -98.8792, False, "1 h 10", 27000),
    ("15089", "15", "089", "Estado de México", "Tenango del Aire", 19.1572, -98.8583, False, "1 h 05", 12470),
    ("15022", "15", "022", "Estado de México", "Cocotitlán", 19.2264, -98.8622, False, "1 h 00", 15107),
    ("15083", "15", "083", "Estado de México", "Temamatla", 19.2028, -98.8694, False, "1 h 00", 14130),
    ("15025", "15", "025", "Estado de México", "Chalco", 19.2636, -98.8978, False, "0 h 50", 400057),
    ("15039", "15", "039", "Estado de México", "Ixtapaluca", 19.3181, -98.8823, False, "0 h 45", 542211),
    # Vecinos del corredor y Puebla (2026-09-28). Códigos y centroides salen del DENUE (sector 71):
    # mediana de los establecimientos de la cabecera (cve_loc 0001). Sin tiempo desde CDMX ni población aún.
    # Morelos: alrededores de Tepoztlán, Cuautla y el oriente
    ("17009", "17", "009", "Morelos", "Huitzilac", 19.0326, -99.2653, False, None, None),
    ("17023", "17", "023", "Morelos", "Tlalnepantla", 19.0076, -98.9970, False, None, None),
    ("17030", "17", "030", "Morelos", "Yecapixtla", 18.8824, -98.8626, False, None, None),
    ("17016", "17", "016", "Morelos", "Ocuituco", 18.8763, -98.7756, False, None, None),
    ("17032", "17", "032", "Morelos", "Zacualpan de Amilpas", 18.7847, -98.7698, False, None, None),
    ("17033", "17", "033", "Morelos", "Temoac", 18.7705, -98.7788, False, None, None),
    ("17004", "17", "004", "Morelos", "Ayala", 18.7644, -98.9842, False, None, None),
    ("17024", "17", "024", "Morelos", "Tlaltizapán de Zapata", 18.6849, -99.1187, False, None, None),
    ("17010", "17", "010", "Morelos", "Jantetelco", 18.7162, -98.7763, False, None, None),
    ("17013", "17", "013", "Morelos", "Jonacatepec de Leandro Valle", 18.6856, -98.8026, False, None, None),
    # Estado de México: alrededores de Malinalco, Tenancingo y Ocuilan
    ("15119", "15", "119", "Estado de México", "Zumpahuacán", 18.8357, -99.5774, False, None, None),
    ("15113", "15", "113", "Estado de México", "Villa Guerrero", 18.9616, -99.6415, False, None, None),
    ("15049", "15", "049", "Estado de México", "Joquicingo", 19.0498, -99.5334, False, None, None),
    ("15090", "15", "090", "Estado de México", "Tenango del Valle", 19.1046, -99.5908, False, None, None),
    ("15101", "15", "101", "Estado de México", "Tianguistenco", 19.1803, -99.4674, False, None, None),
    ("15043", "15", "043", "Estado de México", "Xalatlaco", 19.1800, -99.4165, False, None, None),
    ("15040", "15", "040", "Estado de México", "Ixtapan de la Sal", 18.8451, -99.6767, True, None, None),
    ("15107", "15", "107", "Estado de México", "Tonatico", 18.8056, -99.6703, True, None, None),
    # Puebla: Pueblos Mágicos y alrededores
    ("21114", "21", "114", "Puebla", "Puebla", 19.0440, -98.2029, False, None, None),
    ("21140", "21", "140", "Puebla", "San Pedro Cholula", 19.0674, -98.3037, True, None, None),
    ("21119", "21", "119", "Puebla", "San Andrés Cholula", 19.0533, -98.2969, True, None, None),
    ("21019", "21", "019", "Puebla", "Atlixco", 18.9072, -98.4347, True, None, None),
    ("21074", "21", "074", "Puebla", "Huejotzingo", 19.1597, -98.4080, False, None, None),
    ("21026", "21", "026", "Puebla", "Calpan", 19.1053, -98.4651, False, None, None),
    ("21138", "21", "138", "Puebla", "San Nicolás de los Ranchos", 19.0726, -98.4862, False, None, None),
    ("21188", "21", "188", "Puebla", "Tochimilco", 18.8893, -98.5814, False, None, None),
    ("21043", "21", "043", "Puebla", "Cuetzalan del Progreso", 20.0190, -97.5233, True, None, None),
    ("21207", "21", "207", "Puebla", "Zacapoaxtla", 19.8726, -97.5884, False, None, None),
    ("21186", "21", "186", "Puebla", "Tlatlauquitepec", 19.8504, -97.4966, True, None, None),
    ("21174", "21", "174", "Puebla", "Teziutlán", 19.8152, -97.3618, False, None, None),
    ("21208", "21", "208", "Puebla", "Zacatlán", 19.9353, -97.9616, True, None, None),
    ("21053", "21", "053", "Puebla", "Chignahuapan", 19.8367, -98.0327, True, None, None),
    ("21172", "21", "172", "Puebla", "Tetela de Ocampo", 19.8166, -97.8059, True, None, None),
    ("21071", "21", "071", "Puebla", "Huauchinango", 20.1731, -98.0542, True, None, None),
    ("21109", "21", "109", "Puebla", "Pahuatlán", 20.2707, -98.1478, True, None, None),
    ("21197", "21", "197", "Puebla", "Xicotepec", 20.2773, -97.9593, True, None, None),
    # Ciudad de México: las 16 alcaldías (2026-10-02). Centroides = mediana de los establecimientos del
    # DENUE (sector 71) en la alcaldía; población del Censo 2020.
    ("09002", "09", "002", "Ciudad de México", "Azcapotzalco", 19.4825, -99.1854, False, None, 432205),
    ("09003", "09", "003", "Ciudad de México", "Coyoacán", 19.3241, -99.1534, False, None, 614447),
    ("09004", "09", "004", "Ciudad de México", "Cuajimalpa de Morelos", 19.3617, -99.2864, False, None, 217686),
    ("09005", "09", "005", "Ciudad de México", "Gustavo A. Madero", 19.4922, -99.1216, False, None, 1173351),
    ("09006", "09", "006", "Ciudad de México", "Iztacalco", 19.3958, -99.0844, False, None, 404695),
    ("09007", "09", "007", "Ciudad de México", "Iztapalapa", 19.3460, -99.0543, False, None, 1835486),
    ("09008", "09", "008", "Ciudad de México", "La Magdalena Contreras", 19.3131, -99.2462, False, None, 247622),
    ("09009", "09", "009", "Ciudad de México", "Milpa Alta", 19.1994, -99.0198, False, None, 152685),
    ("09010", "09", "010", "Ciudad de México", "Álvaro Obregón", 19.3593, -99.2160, False, None, 759137),
    ("09011", "09", "011", "Ciudad de México", "Tláhuac", 19.2899, -99.0343, False, None, 392313),
    ("09012", "09", "012", "Ciudad de México", "Tlalpan", 19.2810, -99.1797, False, None, 699928),
    ("09013", "09", "013", "Ciudad de México", "Xochimilco", 19.2591, -99.1055, False, None, 442178),
    ("09014", "09", "014", "Ciudad de México", "Benito Juárez", 19.3801, -99.1647, False, None, 434153),
    ("09015", "09", "015", "Ciudad de México", "Cuauhtémoc", 19.4323, -99.1501, False, None, 545884),
    ("09016", "09", "016", "Ciudad de México", "Miguel Hidalgo", 19.4320, -99.1889, False, None, 414470),
    ("09017", "09", "017", "Ciudad de México", "Venustiano Carranza", 19.4281, -99.1094, False, None, 443704),
]


def seed_municipalities() -> int:
    n = 0
    with connect() as conn:
        for cvegeo, ent, mun, state, name, lat, lng, pm, drive, pop in CORRIDOR:
            n += execute(
                conn,
                """
                insert into public.municipalities
                  (cvegeo, cve_ent, cve_mun, state, name, slug, centroid, is_pueblo_magico, drive_from_cdmx, population)
                values (%s, %s, %s, %s, %s, public.slugify(%s), ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s)
                on conflict (cvegeo) do update set
                  name = excluded.name, state = excluded.state, centroid = excluded.centroid,
                  is_pueblo_magico = excluded.is_pueblo_magico, drive_from_cdmx = excluded.drive_from_cdmx,
                  population = excluded.population
                """,
                (cvegeo, ent, mun, state, name, name, lng, lat, pm, drive, pop),
            )
    return n


CVEGEOS = {row[0] for row in CORRIDOR}
NAME_TO_CVEGEO = {row[4].lower(): row[0] for row in CORRIDOR}
