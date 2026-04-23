#!/usr/bin/env python3
"""Parse PDF text and generate chaos bag preset seed data."""
import re, json

# Token mapping from PDF notation (letter → internal key)
TOKEN_MAP = {
    'n': 'skull', 'b': 'cultist', 'v': 'tablet',
    'c': 'elder_thing', 'x': 'tentacle', 'z': 'elder_star'
}

# Spanish display names for token letters in text
TOKEN_NAMES_ES = {
    'n': 'calavera',
    'b': 'adepto',
    'v': 'tablilla',
    'c': 'ancestral',
    'x': 'caos',
    'z': 'signo de los antiguos',
}

def replace_token_letters(text):
    """Replace standalone token letters (b, v, c, n, x, z) with their Spanish names.

    Only replaces when the letter appears as a standalone token reference, not as
    part of a word or abbreviation (e.g. 'v. III' is NOT replaced).
    """
    if not text:
        return text
    def _replace(m):
        letter = m.group(1)
        return TOKEN_NAMES_ES[letter]
    # Match a token letter that is:
    #   - preceded by a space, comma, opening paren/bracket, or start of string
    #   - followed by space, comma, closing paren, period+space (end of sentence),
    #     period+end, or end of string
    #   - NOT followed by '.' then a non-space (abbreviation like 'v. III')
    return re.sub(
        r'(?:(?<=[ ,(])|(?<=^))([nbvcxz])(?=[ ,);.]|$)',
        _replace,
        text,
        flags=re.MULTILINE,
    )

def parse_tokens(line):
    """Parse a token line like '+1, +1, 0, 0, –1, –1, n, n, b, x, z' into tokenCounts dict."""
    # Normalize dashes
    line = line.replace('–', '-').replace('—', '-')
    # Remove trailing period
    line = line.rstrip('. ')
    
    counts = {}
    parts = [p.strip() for p in line.split(',')]
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # Map special tokens
        if p in TOKEN_MAP:
            token = TOKEN_MAP[p]
        elif re.match(r'^[+-]?\d+$', p):
            token = p if p.startswith('+') or p.startswith('-') else p
            # Normalize: ensure positive numbers have +
            if p.isdigit() and int(p) > 0:
                token = f'+{p}'
        else:
            # Try to handle merged tokens like "-5 n" (missing comma)
            subparts = p.split()
            for sp in subparts:
                sp = sp.strip()
                if sp in TOKEN_MAP:
                    t = TOKEN_MAP[sp]
                    counts[t] = counts.get(t, 0) + 1
                elif re.match(r'^[+-]?\d+$', sp):
                    t = sp
                    counts[t] = counts.get(t, 0) + 1
            continue
        counts[token] = counts.get(token, 0) + 1
    return counts

# Normalize difficulty names
def norm_diff(d):
    d = d.strip()
    if d.startswith('Fácil'): return 'Fácil'
    if d.startswith('Normal'): return 'Normal'
    if d.startswith('Difícil'): return 'Difícil'
    if d.startswith('Experto'): return 'Experto'
    return d

# Per-scenario metadata: campaignLog, victoryRequirements, scenarioValue (X for EXP=Y*(X-1))
SCENARIO_INFO = {
    # La Noche de la Fanática
    ('La Noche de la Fanática', 'El Encuentro'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 o R2'},
    ('La Noche de la Fanática', 'Máscaras de Medianoche'): {'scenarioValue': 2, 'campaignLog': 'Lita se vio obligada a encontrar a otros para que la ayudaran en su causa. Tu Casa sigue en pie. El Sacerdote Gul Sigue Vivo.', 'victoryRequirements': 'R1 o R2 y anotar al menos 5 sectarios en «Sectarios que interrogamos»'},
    ('La Noche de la Fanática', 'El Devorador de las Profundidades'): {'scenarioValue': 3, 'campaignLog': 'Elige, al azar, 2 sectarios de los 6 posibles para añadirlos a «Sectarios que escaparon».', 'victoryRequirements': 'R1'},
    # El Legado de Dunwich
    ('El Legado de Dunwich', 'Actividad Extracurricular'): {'scenarioValue': 1, 'campaignLog': 'Considera que este es el primer escenario de la campaña.', 'victoryRequirements': 'R1, R2 o R3'},
    ('El Legado de Dunwich', 'La Casa Siempre Gana'): {'scenarioValue': 1, 'campaignLog': 'Considera que este es el primer escenario de la campaña.', 'victoryRequirements': 'R2 o R3'},
    ('El Legado de Dunwich', 'El Museo Miskatonic'): {'scenarioValue': 2, 'campaignLog': 'El Dr. Henry Armitage ha sido secuestrado.', 'victoryRequirements': 'R1 o R2'},
    ('El Legado de Dunwich', 'El Essex County Express'): {'scenarioValue': 3, 'campaignLog': None, 'victoryRequirements': 'R1'},
    ('El Legado de Dunwich', 'Sangre en el Altar'): {'scenarioValue': 4, 'campaignLog': 'Al crear los «sacrificios potenciales», usa: Dr. Henry Armitage, Dr. Francis Morgan, Profesor Warren Rice, Zebulon Whateley y Earl Sawyer. Los investigadores no quedaron retrasados de camino a Dunwich. La banda de O\'Bannion no tiene cuentas que saldar.', 'victoryRequirements': 'R1, R2 o R3 y no anotar más de 3 «sacrificios a Yog-Sothoth»'},
    ('El Legado de Dunwich', 'Invisibles y Sin Dimensión'): {'scenarioValue': 5, 'campaignLog': '3 personajes fueron sacrificados a Yog-Sothoth. No incluyas el Polvo de Ibn-Ghazi en ningún mazo. No cojas ninguna Debilidad adicional. El Dr. Henry Armitage ha sido sacrificado a Yog-Sothoth.', 'victoryRequirements': 'R1 o R2 y no escapa más de una Progenie'},
    ('El Legado de Dunwich', 'Donde Aguarda la Perdición'): {'scenarioValue': 6, 'campaignLog': 'Usa el acto 2 – Ascender por la colina (versión III). Naomi no apoya a los investigadores. No escapó ninguna Progenie de Yog-Sothoth. Los investigadores no acabaron con Silas Bishop.', 'victoryRequirements': 'R1'},
    ('El Legado de Dunwich', 'Perdidos en el Tiempo y en el Espacio'): {'scenarioValue': 7, 'campaignLog': 'No leas el epílogo de la campaña incluso aunque ganes el escenario. Considera que todos los eventos previos del registro de campaña han tenido lugar.', 'victoryRequirements': 'R1'},
    # El Camino a Carcosa
    ('El Camino a Carcosa', 'Se Cierra el Telón'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 o R2'},
    ('El Camino a Carcosa', 'El Último Rey'): {'scenarioValue': 2, 'campaignLog': 'Añade al azar 2 fichas b, v o c. El investigador jefe añade «El hombre de la máscara pálida» a su mazo.', 'victoryRequirements': 'R1 y anotar al menos 5 VIPs entre «VIPs interrogados» y «VIPs muertos»'},
    ('El Camino a Carcosa', 'Ecos del Pasado'): {'scenarioValue': 3, 'campaignLog': 'Añade al azar 2 fichas b, v o c. Los Investigadores huyeron de la fiesta.', 'victoryRequirements': 'R1 o R2 o R3'},
    ('El Camino a Carcosa', 'El Juramento Inconfesable'): {'scenarioValue': 4, 'campaignLog': 'Añade al azar 2 fichas b, v o c. Constance Dumain aparece en «VIP interrogados». Los investigadores no se llevaron el broche de ónice. No leas el interludio II – Alma perdida.', 'victoryRequirements': 'R3'},
    ('El Camino a Carcosa', 'El Fantasma de la Verdad'): {'scenarioValue': 5, 'campaignLog': 'Añade al azar 2 fichas b, v o c. Elige Duda o Convicción. Durante la introducción elige al azar si cada evento del registro ocurrió o no. No hay marcas en «persiguiendo al extranjero». Jordan Perry aparece en «VIP interrogados». El investigador jefe añade «El Hombre de la Máscara Pálida» a su mazo.', 'victoryRequirements': 'R1 y R2'},
    ('El Camino a Carcosa', 'La Máscara Pálida'): {'scenarioValue': 6, 'campaignLog': 'Añade al azar 2 fichas b, v o c. El investigador jefe añade «El Hombre de la Máscara Pálida» a su mazo. Los Investigadores encontraron la casa de Nigel. Ishimaru Haruko aparece en «VIP Interrogados» y en «VIP Muertos».', 'victoryRequirements': 'R1 o R2'},
    ('El Camino a Carcosa', 'Surgen Estrellas Negras'): {'scenarioValue': 7, 'campaignLog': 'Añade al azar 2 fichas b, v o c. El investigador jefe añade «El Hombre de la Máscara Pálida» a su mazo. Los investigadores no cogen ninguna debilidad adicional.', 'victoryRequirements': 'R1 o R2'},
    ('El Camino a Carcosa', 'Penumbrosa Carcosa'): {'scenarioValue': 8, 'campaignLog': 'Elige: Duda (8 Dudas, 0 Convicciones), Convicción (0 Dudas, 8 Convicciones) o nada (0/0). Al azar: investigadores abrieron camino de abajo (+2 v) o de arriba (+2 c). No hay marcas en «Persiguiendo al Extranjero». No leas el epílogo.', 'victoryRequirements': 'R1 o R2 o R3'},
    # La Era Olvidada
    ('La Era Olvidada', 'Naturaleza Salvaje'): {'scenarioValue': 1, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido. Si el grupo lo tiene, elegid qué investigador cuenta con él.', 'victoryRequirements': 'R1 o R2'},
    ('La Era Olvidada', 'La Perdición de Etzli'): {'scenarioValue': 2, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido. Los investigadores se vieron obligados a esperar suministros adicionales.', 'victoryRequirements': 'R1, ningún investigador puede quedar derrotado'},
    ('La Era Olvidada', 'Hilos del Destino'): {'scenarioValue': 3, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido. Elige: los investigadores dieron la custodia de la reliquia a Alejandro o a Harlan Earnstone.', 'victoryRequirements': 'R1, ningún acto por completar'},
    ('La Era Olvidada', 'El Límite del Otro Lado'): {'scenarioValue': 4, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido. La Reliquia ha desaparecido. Los investigadores forjaron un vínculo con Ithaca. Los investigadores rescataron a Alejandro. En la preparación elige si añadir b, v, o ninguna.', 'victoryRequirements': 'R1 y anotar que «Ichtaca tiene confianza en los investigadores»'},
    ('La Era Olvidada', 'El Corazón de los Ancianos (parte 1)'): {'scenarioValue': 5, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido. Los investigadores conocen 2 caminos.', 'victoryRequirements': 'R1'},
    ('La Era Olvidada', 'El Corazón de los Ancianos (parte 2)'): {'scenarioValue': 5, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido.', 'victoryRequirements': 'R1 o R2'},
    ('La Era Olvidada', 'La Ciudad de los Archivos'): {'scenarioValue': 6, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido.', 'victoryRequirements': 'R1 y anotar «el proceso fue perfeccionado»'},
    ('La Era Olvidada', 'Las Profundidades de Yoth'): {'scenarioValue': 7, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro en el primer momento que sea requerido. Ithaca ha recuperado la fe. Hay 6 marcas en «Furia de Yig». El Heraldo sigue Vivo.', 'victoryRequirements': 'R2'},
    ('La Era Olvidada', 'Eones Destrozados'): {'scenarioValue': 8, 'campaignLog': 'Determina al azar si el grupo tiene o no cada suministro. Los braseros están encendidos. La reliquia ha desaparecido. En la preparación elige si: Ithaca está en contra (+3 v), Alejandro está en contra (+3 b), o ambos (+2 c). Hay 6 marcas en «Furia de Yig».', 'victoryRequirements': 'R1 o R2 o R3'},
    # El Círculo Roto
    ('El Círculo Roto', 'La Hora Bruja'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 o R2'},
    ('El Círculo Roto', 'A Las Puertas de la Muerte'): {'scenarioValue': 2, 'campaignLog': 'Determina al azar si añades 2 v o 2 c a la bolsa. Ningún perfil de «Personas Desaparecidas» está tachado. Se dejaron 3 pistas por investigador.', 'victoryRequirements': 'R1'},
    ('El Círculo Roto', 'El Nombre Secreto'): {'scenarioValue': 3, 'campaignLog': 'Elige: «Los Investigadores son Miembros de la Logia», «Enemigos de la Logia» o «no descubrieron nada sobre los planes de la Logia».', 'victoryRequirements': 'R2'},
    ('El Círculo Roto', 'La Paga del Pecado'): {'scenarioValue': 4, 'campaignLog': 'Hay 3 recuerdos anotados en «Recuerdos Recuperados».', 'victoryRequirements': 'R1 y no anotar más de 1 hereje liberado'},
    ('El Círculo Roto', 'Por el Bien Común'): {'scenarioValue': 5, 'campaignLog': 'Elige: «Los Investigadores son Miembros de la Logia», «Enemigos de la Logia» o «no descubrieron nada sobre los planes de la Logia».', 'victoryRequirements': 'R1 o R2 o R3'},
    ('El Círculo Roto', 'Unión y Desilusión'): {'scenarioValue': 6, 'campaignLog': 'Determina al azar si cada persona en «Personas Desaparecidas» está tachada. Si los investigadores «Se han puesto de parte del Aquelarre», aplica las instrucciones correspondientes.', 'victoryRequirements': 'R1'},
    ('El Círculo Roto', 'En las Garras del Caos'): {'scenarioValue': 7, 'campaignLog': 'En la preparación decide una de las siguientes: «Anette Mason está poseída por el mal» o «Carl Sanford posee los secretos del universo».', 'victoryRequirements': 'R1 o R2'},
    ('El Círculo Roto', 'Ante el Trono Negro'): {'scenarioValue': 8, 'campaignLog': 'Anota 4 marcas en «El Camino se Extiende Ante los Investigadores».', 'victoryRequirements': 'R3'},
    # Devoradores de Sueños
    ('Devoradores de Sueños', 'Más Allá de las Puertas del Sueño'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 o R2'},
    ('Devoradores de Sueños', 'Pesadilla Consciente'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 o R3'},
    ('Devoradores de Sueños', 'La Búsqueda de Kadath'): {'scenarioValue': 3, 'campaignLog': '«Los Gatos Obtuvieron su Tributo de los Zoogs».', 'victoryRequirements': 'R1 o R2 y anotar al menos 7 señales de los dioses'},
    ('Devoradores de Sueños', 'Mil Formas de Horror'): {'scenarioValue': 3, 'campaignLog': '«El Gato Negro está con los Investigadores del Mundo de la Vigilia».', 'victoryRequirements': 'R1'},
    ('Devoradores de Sueños', 'El Lado Oscuro de la Luna'): {'scenarioValue': 5, 'campaignLog': '«Ninguno de los investigadores fue capturado». «Randolph Carter evitó la captura».', 'victoryRequirements': 'R1'},
    ('Devoradores de Sueños', 'Punto sin Retorno'): {'scenarioValue': 5, 'campaignLog': '«El Gato negro no está con los investigadores en el mundo de la Vigilia». Decide el destino de Randolph Carter con una moneda. Lanza 1d6, anota tantas marcas en «peldaños del puente».', 'victoryRequirements': 'R1'},
    ('Devoradores de Sueños', 'Donde Moran los Dioses'): {'scenarioValue': 7, 'campaignLog': '«Los investigadores viajaron al desierto frío». «El gato Negro está con los soñadores». Decide el destino de Randolph Carter con una moneda. No hay marcas en «pruebas de Kadath».', 'victoryRequirements': 'R1'},
    ('Devoradores de Sueños', 'Tejedora del Cosmos'): {'scenarioValue': 7, 'campaignLog': 'Lanza 1d12, anota tantas marcas en «Peldaños del puente». Decide el destino de Randolph Carter con una moneda. «El gato negro está con los investigadores en el mundo de la vigilia».', 'victoryRequirements': 'R1'},
    # La Conspiración de Innsmouth
    ('La Conspiración de Innsmouth', 'El Pozo de la Desesperación'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1'},
    ('La Conspiración de Innsmouth', 'La Desaparición de Elina Harper'): {'scenarioValue': 2, 'campaignLog': '«Una decisión de no separarse».', 'victoryRequirements': 'R2, R3, R4, R5, R6 o R7'},
    ('La Conspiración de Innsmouth', 'Hasta el Cuello'): {'scenarioValue': 3, 'campaignLog': '«Zadok Allen quiere sangre». No hay lugar rodeado en «posibles escondites».', 'victoryRequirements': 'R1 y anotar «los investigadores llegaron a salvo a sus vehículos»'},
    ('La Conspiración de Innsmouth', 'Arrecife del Diablo'): {'scenarioValue': 4, 'campaignLog': '«La Misión Tuvo Éxito». «Una Batalla con un Horripilante demonio».', 'victoryRequirements': 'R1 y conseguir las 3 llaves'},
    ('La Conspiración de Innsmouth', 'Horror a Toda Máquina'): {'scenarioValue': 5, 'campaignLog': '«El Terror del Arrecife del Diablo Sigue Vivo».', 'victoryRequirements': 'R1'},
    ('La Conspiración de Innsmouth', 'Una Luz en la Niebla'): {'scenarioValue': 6, 'campaignLog': '«Los investigadores llegaron al Cabo del Halcón antes de la salida del sol». «Llevaron al faro el ídolo, el manto y la diadema».', 'victoryRequirements': 'R1'},
    ('La Conspiración de Innsmouth', 'La Guarida de Dagón'): {'scenarioValue': 7, 'campaignLog': '«La misión tuvo éxito». «Una decisión de no separarse». «Un encuentro con una secta secreta».', 'victoryRequirements': 'R1 y no anotar «Dagon ha despertado»'},
    ('La Conspiración de Innsmouth', 'Hacia el Remolino'): {'scenarioValue': 8, 'campaignLog': "Antes de la preparación elegid dos condiciones entre: tener la llave de Y'ha-nthlei, tener el mapa, el guardián ha sido derrotado, la puerta te reconoce como guardián. Determinar al azar si cada investigador tiene traje de buzo.", 'victoryRequirements': 'R2'},
    # Los Confines de la Tierra
    ('Los Confines de la Tierra', 'Hielo y Muerte (parte 1)'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 y acampar en un refugio con valor 7 o más'},
    ('Los Confines de la Tierra', 'Hielo y Muerte (parte 2)'): {'scenarioValue': 2, 'campaignLog': 'Lanza 1d8, anota esa cantidad de miembros de la expedición en «Desaparecidos». Elige un lugar al azar y revela 4 lugares adicionales.', 'victoryRequirements': 'R1 y todos los nombres en «Desaparecidos» están tachados'},
    ('Los Confines de la Tierra', 'Hielo y Muerte (parte 3)'): {'scenarioValue': 3, 'campaignLog': 'Lanza 1d8, tacha esa cantidad de miembros de la expedición (están muertos). Elige un lugar al azar y revela 4 lugares adicionales.', 'victoryRequirements': 'R1 o R2'},
    ('Los Confines de la Tierra', 'Espejismo Letal'): {'scenarioValue': 4, 'campaignLog': 'Considera que es la tercera vez que juegas. Anota al azar 9 lugares en «Recuerdos Descubiertos»; el investigador jefe puede anotar uno más. Lanza 1d8, tacha esa cantidad de miembros (están muertos).', 'victoryRequirements': 'R1 y anotar al menos 3 recuerdos desterrados'},
    ('Los Confines de la Tierra', 'Hacia los Picos Prohibidos'): {'scenarioValue': 5, 'campaignLog': 'Lanza 1d8, tacha esa cantidad de miembros (están muertos). Anota el Trineo de Madera en «Recuerdos Recuperados».', 'victoryRequirements': 'R1'},
    ('Los Confines de la Tierra', 'La Ciudad de los Antiguos'): {'scenarioValue': 6, 'campaignLog': 'Lanza 1d8, tacha esa cantidad de miembros (están muertos). Anota «Dinamita» en suministros recuperados. «Los Investigadores exploraron las afueras de la ciudad».', 'victoryRequirements': 'R1'},
    ('Los Confines de la Tierra', 'El Corazón de la Locura (parte 1)'): {'scenarioValue': 7, 'campaignLog': 'Lanza 1d8, tacha esa cantidad de miembros (están muertos).', 'victoryRequirements': 'R1 o R2 y activar al menos 3 sellos'},
    ('Los Confines de la Tierra', 'El Corazón de la Locura (parte 2)'): {'scenarioValue': 7, 'campaignLog': 'Lanza 1d8, tacha esa cantidad de miembros (están muertos). El investigador jefe decide cuántos sellos «han sido recuperados». Por cada uno añade una debilidad Tekili-li a cada mazo. Si son elegidos menos de 5, retira al azar los sobrantes.', 'victoryRequirements': 'R1 o R2'},
    # Las Llaves Escarlata (todas X=4, excepción: Acertijos y Lluvia X=1)
    ('Las Llaves Escarlata', 'Acertijos y Lluvia'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 o R2'},
    ('Las Llaves Escarlata', 'Calor Muerto'): {'scenarioValue': 4, 'campaignLog': 'Lanza 1d20, el tiempo transcurrido es el resultado.', 'victoryRequirements': 'R3 o R4'},
    ('Las Llaves Escarlata', 'Sombras Sanguinas'): {'scenarioValue': 4, 'campaignLog': None, 'victoryRequirements': 'R1 o R2'},
    ('Las Llaves Escarlata', 'Tratos en la Oscuridad'): {'scenarioValue': 4, 'campaignLog': 'Lanza 1d20, el tiempo transcurrido es el resultado.', 'victoryRequirements': 'R1'},
    ('Las Llaves Escarlata', 'Bailar Como Locos'): {'scenarioValue': 4, 'campaignLog': 'Determina al azar si ha transcurrido 15 o 25 de tiempo.', 'victoryRequirements': 'R1'},
    ('Las Llaves Escarlata', 'Sobre Hielo Peligroso'): {'scenarioValue': 4, 'campaignLog': 'Ha transcurrido 10 de tiempo.', 'victoryRequirements': 'R2 o R3'},
    ('Las Llaves Escarlata', 'Perros de Guerra'): {'scenarioValue': 4, 'campaignLog': 'Ha transcurrido 10 de tiempo.', 'victoryRequirements': 'R1 o R2'},
    ('Las Llaves Escarlata', 'Sombras de Sufrimiento'): {'scenarioValue': 4, 'campaignLog': 'El agente Flint ha desaparecido. Ha transcurrido 10 de tiempo.', 'victoryRequirements': 'R1 o R2'},
    ('Las Llaves Escarlata', 'Sin Rastro'): {'scenarioValue': 4, 'campaignLog': None, 'victoryRequirements': 'R1'},
    ('Las Llaves Escarlata', 'El Congreso de las Llaves'): {'scenarioValue': 4, 'campaignLog': 'Dado el registro complejo, elegid si llegasteis a Tunguska por informe de estado o por voluntad propia. En el juicio 1, omitid la votación. Podéis elegir si hay mayoría de síes o de noes.', 'victoryRequirements': 'R1'},
    # La Fiesta del Valle de la Cicuta (todas X=4)
    ('La Fiesta del Valle de la Cicuta', 'Escrito en la Roca'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c.', 'victoryRequirements': 'R1 o R2'},
    ('La Fiesta del Valle de la Cicuta', 'La Casa Cicuta'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c.', 'victoryRequirements': 'R1 y «Los Investigadores han encontrado a la pequeña Sylvie», o R1 con 10+ sellos en juego, o R1 con 10+ Lugares enemigo en zona de victoria'},
    ('La Fiesta del Valle de la Cicuta', 'El Páramo Silencioso'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c.', 'victoryRequirements': 'R1'},
    ('La Fiesta del Valle de la Cicuta', 'La Hermana Perdida'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c.', 'victoryRequirements': 'R1'},
    ('La Fiesta del Valle de la Cicuta', 'La Cosa de las Profundidades'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c.', 'victoryRequirements': 'R1, R2 o R4'},
    ('La Fiesta del Valle de la Cicuta', 'La Hondonada Retorcida'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c.', 'victoryRequirements': 'R1'},
    ('La Fiesta del Valle de la Cicuta', 'La Noche Más Larga'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c. Dos o más habitantes compartieron un baile (determina al azar). El Oso fue Herido.', 'victoryRequirements': 'R1 y 2 o menos daños en apoyos historia'},
    ('La Fiesta del Valle de la Cicuta', 'El Destino del Valle'): {'scenarioValue': 4, 'campaignLog': '¿Has venido a estudiar o de fiesta? Añade v si estudiar, c si de fiesta. Determina el día al azar (1d6): 1=Día 1 día; 2=Día 1 noche; 3=Día 2 día; 4=Día 2 noche; 5=Día 3 día; 6=Día 3 noche. Si es Día 2 añade v y c; si es Día 3 añade v, v, c, c. El nivel de relación con cada habitante se determina con 1d4. En «El Destino del Valle» puedes elegir cualquier opción ignorando los requisitos.', 'victoryRequirements': 'R1, R2 o R3'},
    # La Ciudad Sumergida
    ('La Ciudad Sumergida', 'Un Último Trabajo'): {'scenarioValue': 1, 'campaignLog': None, 'victoryRequirements': 'R1 y haber descubierto un idioma alienígena'},
    ('La Ciudad Sumergida', 'La Muralla Occidental'): {'scenarioValue': 2, 'campaignLog': 'Elegid si la expedición se dirigió al oeste (2) o al este (7). Si al este añadid v, v, c. Cada investigador no tiene asignada tarea. Al azar si «la criatura ha sido derrotada». Los investigadores no han obtenido ningún artefacto.', 'victoryRequirements': 'R1 o R2. Consigue descifrar al menos 3 símbolos'},
    ('La Ciudad Sumergida', 'El Barrio Sumergido'): {'scenarioValue': 3, 'campaignLog': 'Elegid si la expedición se dirigió al oeste (3) o al este (6). Si al oeste añadid b; si al este añadid v, v, c. Cada investigador no tiene asignada tarea. Los investigadores no han obtenido ningún artefacto.', 'victoryRequirements': 'R1. Consigue descifrar al menos 2 símbolos'},
    ('La Ciudad Sumergida', 'El Apiario'): {'scenarioValue': 4, 'campaignLog': 'Elegid si la expedición se dirigió al oeste (4) o al este (5). Si al oeste añadid b; si al este añadid v, c. Cada investigador no tiene asignada tarea. Al azar si «la criatura ha sido derrotada». Los investigadores no han obtenido ningún artefacto.', 'victoryRequirements': 'R1 o R3. Consigue descifrar al menos 4 símbolos. Un investigador debe acabar con «Máscara» Macabra en juego'},
    ('La Ciudad Sumergida', 'La Gran Cámara'): {'scenarioValue': 5, 'campaignLog': 'Elegid si la expedición se dirigió al oeste (5) o al este (4). Si al oeste añadid b, b; si al este añadid v, v. Cada investigador no tiene asignada tarea. Los investigadores no han obtenido ningún artefacto. Al azar si la energía fue desviada.', 'victoryRequirements': 'R1 o R2. Consigue descifrar al menos 4 símbolos. Un investigador debe acabar con Tablilla de Marea en juego'},
    ('La Ciudad Sumergida', 'La Corte de los Antiguos'): {'scenarioValue': 6, 'campaignLog': "Elegid si la expedición se dirigió al oeste (6) o al este (3). Si al oeste añadid b, b, c; si al este añadid v. Cada investigador no tiene asignada tarea. Los investigadores no han obtenido ningún artefacto. Al azar si «la criatura ha sido derrotada».", 'victoryRequirements': "R1 o R2. Consigue descifrar al menos 4 símbolos. Un investigador debe acabar con el Fragmento de Y'ch'lecht en juego"},
    ('La Ciudad Sumergida', 'Cañones de Obsidiana'): {'scenarioValue': 7, 'campaignLog': 'Elegid si la expedición se dirigió al oeste (7) o al este (2). Si al oeste añadid b, b, c; si al este añadid v. Cada investigador no tiene asignada tarea. Los investigadores no han obtenido ningún artefacto. Al azar si «la criatura ha sido derrotada».', 'victoryRequirements': 'R1 o R2. Consigue descifrar al menos 4 símbolos. Un investigador debe acabar con la Garra de Obsidiana en juego'},
    ('La Ciudad Sumergida', 'Sepulcro del Durmiente'): {'scenarioValue': 8, 'campaignLog': 'Cada investigador no tiene asignada tarea. Los investigadores no han obtenido ningún artefacto. Al azar si «la criatura ha sido derrotada».', 'victoryRequirements': 'R1'},
    ('La Ciudad Sumergida', 'La Perdición de Arkham (parte 1)'): {'scenarioValue': 8, 'campaignLog': 'Cada investigador ha cumplido una tarea a su elección y entrará por su lado Completado. Los investigadores han obtenido tantos artefactos como jugadores, al azar.', 'victoryRequirements': 'R1 sin pasar por «si todos los investigadores desistieron o fueron derrotados». Un investigador debe acabar con el apoyo Horror de Arcilla en juego'},
    ('La Ciudad Sumergida', 'La Perdición de Arkham (parte 2)'): {'scenarioValue': 8, 'campaignLog': 'Cada investigador ha cumplido una tarea a su elección. Los investigadores han obtenido tantos artefactos como jugadores, al azar. Adicionalmente, podéis decidir tener 5 artefactos anotados y no tachados para seleccionar otra opción en «La Perdición de Arkham 1».', 'victoryRequirements': 'R1 o R2'},
}

# All campaign data parsed from PDF
data = []

def add(campaign, scenario, difficulty, tokens_str):
    tc = parse_tokens(tokens_str)
    info = SCENARIO_INFO.get((campaign, scenario), {})
    data.append({
        'campaign': campaign,
        'scenario': scenario,
        'difficulty': norm_diff(difficulty),
        'tokenCounts': tc,
        'campaignLog': replace_token_letters(info.get('campaignLog')),
        'victoryRequirements': replace_token_letters(info.get('victoryRequirements')),
        'scenarioValue': info.get('scenarioValue'),
    })

# ========================================
# La Noche de la Fanática
# ========================================
C = 'La Noche de la Fanática'

for s in ['El Encuentro', 'Máscaras de Medianoche', 'El Devorador de las Profundidades']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, v, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, v, x, z')
    add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, v, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, v, x, z')

# ========================================
# El Legado de Dunwich
# ========================================
C = 'El Legado de Dunwich'

# 1A & 1B - no tablet (v)
for s in ['Actividad Extracurricular', 'La Casa Siempre Gana']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, x, z')
    add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, x, z')

# 2 - El Museo Miskatonic
s = 'El Museo Miskatonic'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, v, c, x, z')

# 3 - El Essex County Express
s = 'El Essex County Express'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, v, c, x, z')

# 4 - Sangre en el Altar
s = 'Sangre en el Altar'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -2, n, n, b, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -3, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5, -6, -8, n, n, b, v, c, x, z')

# 5 - Invisibles y Sin Dimensión (same as 4)
s = 'Invisibles y Sin Dimensión'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -2, n, n, b, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -3, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5, -6, -8, n, n, b, v, c, x, z')

# 6 - Donde Aguarda la Perdición
s = 'Donde Aguarda la Perdición'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -2, n, n, b, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -3, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5, -6, -8, n, n, b, v, c, x, z')

# 7 - Perdidos en el tiempo y en el espacio
s = 'Perdidos en el Tiempo y en el Espacio'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -2, -3, n, n, b, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5, -6, -7, -8, n, n, b, v, c, x, z')

# ========================================
# El Camino a Carcosa
# ========================================
C = 'El Camino a Carcosa'

# 1-4: skull x3, no cultist/tablet/elder_thing
for s in ['Se Cierra el Telón', 'El Último Rey', 'Ecos del Pasado', 'El Juramento Inconfesable']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, n, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, n, x, z')
    add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, n, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, n, x, z')

# 5-7: adds -2 (easy) / -3 (normal) / -4 (hard) / -5 (expert) extra
for s in ['El Fantasma de la Verdad', 'La Máscara Pálida', 'Surgen Estrellas Negras']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -2, n, n, n, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -3, -4, n, n, n, x, z')
    add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, n, n, n, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5, -6, -8, n, n, n, x, z')

# 8 - Penumbrosa Carcosa
s = 'Penumbrosa Carcosa'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -2, -3, n, n, n, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -3, -4, -5, n, n, n, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, n, n, n, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5, -6, -7, -8, n, n, n, x, z')

# ========================================
# La Era Olvidada
# ========================================
C = 'La Era Olvidada'

# 1 - Naturaleza Salvaje (no cultist, no tablet)
s = 'Naturaleza Salvaje'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -3, n, n, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, 0, -1, -2, -2, -3, -5, n, n, c, x, z')
add(C, s, 'Difícil', '+1, 0, 0, -1, -2, -3, -3, -4, -6, n, n, c, x, z')
add(C, s, 'Experto', '0, -1, -2, -2, -3, -3, -4, -4, -6, -8, n, n, c, x, z')

# 2 - La Perdición de Etzli (adds cultist)
s = 'La Perdición de Etzli'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -3, n, n, b, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, 0, -1, -2, -2, -3, -5, n, n, b, c, x, z')
add(C, s, 'Difícil', '+1, 0, 0, -1, -2, -3, -3, -4, -6, n, n, b, c, x, z')
add(C, s, 'Experto', '0, -1, -2, -2, -3, -3, -4, -4, -6, -8, n, n, b, c, x, z')

# 3-8: all have b, v, c
for s in ['Hilos del Destino', 'El Límite del Otro Lado', 
          'El Corazón de los Ancianos (parte 1)', 'El Corazón de los Ancianos (parte 2)',
          'La Ciudad de los Archivos', 'Las Profundidades de Yoth', 'Eones Destrozados']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -3, n, n, b, v, c, x, z')
    add(C, s, 'Normal', '+1, 0, 0, 0, -1, -2, -2, -3, -5, n, n, b, v, c, x, z')
    add(C, s, 'Difícil', '+1, 0, 0, -1, -2, -3, -3, -4, -6, n, n, b, v, c, x, z')
    add(C, s, 'Experto', '0, -1, -2, -2, -3, -3, -4, -4, -6, -8, n, n, b, v, c, x, z')

# ========================================
# El Círculo Roto
# ========================================
C = 'El Círculo Roto'

# 1-3: no cultist/tablet/elder_thing
for s in ['La Hora Bruja', 'A Las Puertas de la Muerte', 'El Nombre Secreto']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -3, n, n, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, n, n, x, z')
    add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -4, -5, n, n, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -6, -8, n, n, x, z')

# 4-7: adds b, v, c
for s in ['La Paga del Pecado', 'Por el Bien Común', 'Unión y Desilusión', 'En las Garras del Caos']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -3, n, n, b, v, c, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, n, n, b, v, c, x, z')
    add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -4, -5, n, n, b, v, c, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -6, -8, n, n, b, v, c, x, z')

# 8 - Ante el Trono Negro (adds extra -3/-4/-5/-6)
s = 'Ante el Trono Negro'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -3, -3, n, n, b, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -4, -5, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -6, -6, -8, n, n, b, v, c, x, z')

# ========================================
# Devoradores de Sueños
# ========================================
C = 'Devoradores de Sueños'

# Campaign A (Sueños): b, v, v pattern
# 1A
s = 'Más Allá de las Puertas del Sueño'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -2, b, v, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, b, v, v, x, z')
add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -3, -4, -5, b, v, v, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -4, -5, -6, -8, b, v, v, x, z')

# 1B - Campaign B (Vigilia): n, n, b, c, c pattern
s = 'Pesadilla Consciente'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, c, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, c, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, c, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, c, c, x, z')

# 3A - n, n, n, b, v, v
s = 'La Búsqueda de Kadath'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -2, n, n, n, b, v, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, n, n, n, b, v, v, x, z')
add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, n, b, v, v, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -4, -5, -6, -8, n, n, n, b, v, v, x, z')

# 3B - n, n, b, c, c
s = 'Mil Formas de Horror'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, c, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, c, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, c, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, c, c, x, z')

# 5A - n, n, n, b, v, v
s = 'El Lado Oscuro de la Luna'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -2, n, n, n, b, v, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, n, n, n, b, v, v, x, z')
add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, n, b, v, v, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -4, -5, -6, -8, n, n, n, b, v, v, x, z')

# 5B - n, n, b, c, c
s = 'Punto sin Retorno'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, c, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, c, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, c, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, c, c, x, z')

# 7A - n, n, n, b, v, v
s = 'Donde Moran los Dioses'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -2, n, n, n, b, v, v, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, n, n, n, b, v, v, x, z')
add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, n, b, v, v, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -4, -5, -6, -8, n, n, n, b, v, v, x, z')

# 7B - n, n, b, c, c
s = 'Tejedora del Cosmos'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, b, c, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, c, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, c, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, c, c, x, z')

# ========================================
# La Conspiración de Innsmouth
# ========================================
C = 'La Conspiración de Innsmouth'

# All scenarios: b, b, v, v, c, c (double special tokens)
for s in ['El Pozo de la Desesperación', 'La Desaparición de Elina Harper', 
          'Hasta el Cuello', 'Arrecife del Diablo', 'Horror a Toda Máquina',
          'Una Luz en la Niebla', 'La Guarida de Dagón', 'Hacia el Remolino']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -2, -2, n, n, b, b, v, v, c, c, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -2, -2, -3, -4, n, n, b, b, v, v, c, c, x, z')
    add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, b, v, v, c, c, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -4, -4, -5, -6, -8, n, n, b, b, v, v, c, c, x, z')

# ========================================
# Los Confines de la Tierra
# ========================================
C = 'Los Confines de la Tierra'

# 1-5: b, v (no elder_thing until scenario 6)
for s in ['Hielo y Muerte (parte 1)', 'Hielo y Muerte (parte 2)', 'Hielo y Muerte (parte 3)',
          'Espejismo Letal', 'Hacia los Picos Prohibidos']:
    add(C, s, 'Fácil', '+1, +1, +1, 0, 0, -1, -1, -1, -2, -2, n, n, b, v, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, v, x, z')
    add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -4, -4, -5, n, n, b, v, x, z')
    add(C, s, 'Experto', '0, -1, -2, -2, -3, -4, -4, -5, -7, n, n, b, v, x, z')

# 6: adds elder_thing
s = 'La Ciudad de los Antiguos'
add(C, s, 'Fácil', '+1, +1, +1, 0, 0, -1, -1, -1, -2, -2, n, n, b, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -4, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -2, -2, -3, -4, -4, -5, -7, n, n, b, v, c, x, z')

# 7: adds double elder_thing
for s in ['El Corazón de la Locura (parte 1)', 'El Corazón de la Locura (parte 2)']:
    add(C, s, 'Fácil', '+1, +1, +1, 0, 0, -1, -1, -1, -2, -2, n, n, b, v, c, c, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, v, c, c, x, z')
    add(C, s, 'Difícil', '0, 0, -1, -1, -2, -2, -3, -4, -4, -5, n, n, b, v, c, c, x, z')
    add(C, s, 'Experto', '0, -1, -2, -2, -3, -4, -4, -5, -7, n, n, b, v, c, c, x, z')

# ========================================
# Las Llaves Escarlata
# ========================================
C = 'Las Llaves Escarlata'

# All scenarios same base: v, c (no cultist b)
for s in ['Acertijos y Lluvia', 'Calor Muerto', 'Sombras Sanguinas', 'Tratos en la Oscuridad',
          'Bailar Como Locos', 'Sobre Hielo Peligroso', 'Perros de Guerra', 
          'Sombras de Sufrimiento', 'Sin Rastro', 'El Congreso de las Llaves']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, n, n, v, c, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, c, x, z')
    add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, c, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, c, x, z')

# ========================================
# La Fiesta del Valle de la Cicuta
# ========================================
C = 'La Fiesta del Valle de la Cicuta'

for s in ['Escrito en la Roca', 'La Casa Cicuta', 'El Páramo Silencioso', 'La Hermana Perdida',
          'La Cosa de las Profundidades', 'La Hondonada Retorcida', 'La Noche Más Larga',
          'El Destino del Valle']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -3, -4, n, n, x, z')
    add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -5, -5, -7, n, n, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -5, -5, -6, -6, -8, n, n, x, z')

# ========================================
# La Ciudad Sumergida
# ========================================
C = 'La Ciudad Sumergida'

# 1 - Un Último Trabajo: v, c
s = 'Un Último Trabajo'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, c, x, z')

# 2/7 - La Muralla Occidental: b, v, c
s = 'La Muralla Occidental'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, b, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, b, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, b, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, b, v, c, x, z')

# 3/6 - El Barrio Sumergido: v, c
s = 'El Barrio Sumergido'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, c, x, z')

# 4/5 - El Apiario: v, c
s = 'El Apiario'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, c, x, z')

# 5/4 - La Gran Cámara: v, c
s = 'La Gran Cámara'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, c, x, z')

# 6/3 - La Corte de los Antiguos: c only (no v, no b)
s = 'La Corte de los Antiguos'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, c, x, z')

# 7/2 - Cañones de Obsidiana: v, c
s = 'Cañones de Obsidiana'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, v, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, c, x, z')

# 8 - Sepulcro del Durmiente: v, c, c
s = 'Sepulcro del Durmiente'
add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, v, c, c, x, z')
add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, c, c, x, z')
add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, c, c, x, z')
add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, c, c, x, z')

# 8 - La Perdición de Arkham (parts 1 & 2): v, v, b, b, c, c
for s in ['La Perdición de Arkham (parte 1)', 'La Perdición de Arkham (parte 2)']:
    add(C, s, 'Fácil', '+1, +1, 0, 0, 0, -1, -1, -1, -2, -2, -3, n, n, v, v, b, b, c, c, x, z')
    add(C, s, 'Normal', '+1, 0, 0, -1, -1, -1, -2, -2, -3, -4, n, n, v, v, b, b, c, c, x, z')
    add(C, s, 'Difícil', '0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -5, n, n, v, v, b, b, c, c, x, z')
    add(C, s, 'Experto', '0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -6, -8, n, n, v, v, b, b, c, c, x, z')


# Output as JSON
print(json.dumps(data, indent=2, ensure_ascii=False))
print(f"\n// Total presets: {len(data)}", file=__import__('sys').stderr)
