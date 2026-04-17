#!/usr/bin/env python3
"""Parse PDF text and generate chaos bag preset seed data."""
import re, json

# Token mapping from PDF notation
TOKEN_MAP = {
    'n': 'skull', 'b': 'cultist', 'v': 'tablet',
    'c': 'elder_thing', 'x': 'tentacle', 'z': 'elder_star'
}

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

# All campaign data parsed from PDF
data = []

def add(campaign, scenario, difficulty, tokens_str):
    tc = parse_tokens(tokens_str)
    data.append({
        'campaign': campaign,
        'scenario': scenario,
        'difficulty': norm_diff(difficulty),
        'tokenCounts': tc
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
