// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — config.js                                ║
// ║  Global namespace, constants, and mutable app state        ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

// ===================== DATASETS CONFIG =====================
FStats.DATASETS_CONFIG = [
  { name:'Liga Profesional 2025', file:'Liga Profesional 2025.xlsx',
    keywords:['liga profesional','liga prof','profesional','lpf','lp'],
    abbrevs:['prof','lpf','lp','lig prof'], emoji:'🏆' },
  { name:'Primera B Metro 2025', file:'Primera B Metro 2025.xlsx',
    keywords:['primera b','b metro','metro','primera b metro'],
    abbrevs:['bmetro','b met','metro','prim b'], emoji:'🥈' },
  { name:'Primera Nacional 2025', file:'Primera Nacional 2025.xlsx',
    keywords:['primera nacional','nacional','prim nacional'],
    abbrevs:['nac','nacional','pnac','p nac','prim nac'], emoji:'🥉' },
  { name:'Torneo Federal A 2025', file:'Torneo Federal A 2025.xlsx',
    keywords:['federal a','federal','torneo federal'],
    abbrevs:['fed','fed a','federal','tfa'], emoji:'🌐' },
  { name:'Torneo Proyeccion 2025', file:'Torneo Proyeccion 2025.xlsx',
    keywords:['proyeccion','proyección','torneo proyeccion','torneo proyección'],
    abbrevs:['proy','proyec','tp','t proy'], emoji:'🌟' }
];

FStats.GEMINI_MODEL = 'gemini-2.5-flash';

// ===================== SYNONYMS (for column detection) =====================
FStats.SYNONYMS = {
  'porcentaje':'%','percent':'%','porciento':'%','promedio':'media',
  'gol':'goles','asistencia':'asist','pase':'pases','tiro':'remat',
  'cabeza':'cabeza','duelo':'duelos','falta':'faltas','centro':'centros',
  'regate':'regates','penal':'penalti','intercepcion':'interceptacion',
  'entrada':'entradas','corto':'cortos','largo':'largos','lateral':'laterales',
  'progresivo':'progresivos','libre':'libres','clave':'claves','tercio':'tercio',
  'amarilla':'amarill','roja':'roj','minuto':'minut','partido':'partid',
  'disparo':'tiro','remate':'tiro','xg':'xg','xa':'xa','expected':'esperado',
  'aéreo':'aereo','aereo':'aereo',
  'defensivo':'defensiv','defensiva':'defensiv','defensa':'defensiv',
  'ofensivo':'ataque','ofensiva':'ataque','ataque':'ataque',
  'posesion':'posesi','recuperacion':'posesi','recuperar':'posesi',
  'aceleracion':'aceler','carrera':'carrer','progresion':'progres',
  'profundidad':'profundidad','desmarcacion':'desmarque','desmarque':'desmarque'
};

// ===================== POSITION PROFILES (for profile detection) =====================
FStats.POSITION_PROFILES = {
  '9.*tanque|centrodelantero|goleador|killer|ariete|delantero centro|referencia.*area': {
    must: ['gol','tiro','cabeza','aereo','duelo','xg','remate','penal','area','remat','portera','ataque'],
    extra: ['asist','toques.*area','accion.*ataque']
  },
  'creativo|enganche|mediapunta|10|armador|organizador': {
    must: ['asist','clave','xa','pase','progres','chance','key','through','oport','desmarque','profundidad','tercio'],
    extra: ['regate','pase.*adelante','jugada']
  },
  'lateral.*izquierd|lateral izquierdo|carrilero izquierd': {
    must: ['centro','banda.*izquierda','pase','asist','progres','carrera','duelo','regate','defensiv','entrada','intercep','aceler','centros.*tercio'],
    extra: ['duelo.*defensiv','duelo.*atac','pase.*lateral','pase.*adelante','falta']
  },
  'lateral.*derech|lateral derecho|carrilero derech': {
    must: ['centro','banda.*derecha','pase','asist','progres','carrera','duelo','regate','defensiv','entrada','intercep','aceler','centros.*tercio'],
    extra: ['duelo.*defensiv','duelo.*atac','pase.*lateral','pase.*adelante','falta']
  },
  'lateral.*ofensiv|carrilero|wingback': {
    must: ['centro','pase','asist','progres','carrera','duelo','regate','defensiv','entrada','intercep','aceler','banda','centros.*tercio','ataque.*profundidad'],
    extra: ['duelo.*defensiv','duelo.*atac','pase.*lateral','pase.*adelante','falta']
  },
  'central|defensor|zaguero|stopper|marcador central|defensa central': {
    must: ['duelo','intercep','entrada','aereo','cabeza','despe','bloqueo','falta','defensiv','tiro.*intercep','posesi.*entrada','posesi.*intercep','tarjeta','acciones.*defensiv','duelos.*defensiv','duelos.*ganados','duelos.*aereo','pase.*largo','pase.*progres','recuper','corte'],
    extra: ['pase.*largo','altura','peso','duelo.*defensiv','pase.*corto','pase','gol.*cabeza','amarill','roj','minut','partido']
  },
  'volante.*central|contencion|5|pivote|mediocentro|volante defensiv': {
    must: ['pase','intercep','duelo','recuper','progres','entrada','falta','corte','defensiv','pase.*corto','pase.*largo','posesi'],
    extra: ['tarjeta','duelo.*aereo','accion.*defensiv']
  },
  'volante.*ofensiv|interior|8|box.*box|volante mixto': {
    must: ['pase','gol','asist','duelo','progres','clave','tercio','regate','carrera','aceler'],
    extra: ['defensiv','entrada','intercep','xg','xa']
  },
  'extremo|wing|puntero|encarador|winger': {
    must: ['regate','centro','gol','asist','tiro','progres','1v1','dribbl','velocidad','aceler','carrera','atac'],
    extra: ['xg','xa','toques.*area','duelo.*atac']
  },
  'arquero|portero|guardameta|1|goalkeeper': {
    must: ['atajad','salv','gol.*recib','penal','pase','saqu','aere'],
    extra: []
  }
};

// ===================== MUTABLE APP STATE =====================
FStats.loadedDatasets = {};
FStats.datasetSummaries = {};
FStats.apiKey = '';
FStats.isProcessing = false;
FStats.recognition = null;
FStats.isListening = false;
FStats.conversations = [];
FStats.activeConvId = null;
