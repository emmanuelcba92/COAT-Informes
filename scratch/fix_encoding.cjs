const fs = require('fs');
const path = require('path');

const filePath = path.join('e:', 'Proyectos con IA', 'Antigravity', 'Informes COAT', 'src', 'pages', 'AdminPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Use regex to catch double-encoded UTF-8 sequences
// Ãfollowed by a character that is actually the second byte of a UTF-8 sequence
content = content.replace(/Ã¡/g, 'á');
content = content.replace(/Ã©/g, 'é');
content = content.replace(/Ã­/g, 'í');
content = content.replace(/Ã³/g, 'ó');
content = content.replace(/Ãº/g, 'ú');
content = content.replace(/Ã±/g, 'ñ');
content = content.replace(/Ã“/g, 'Ó');
content = content.replace(/Ãš/g, 'Ú');
content = content.replace(/Â¿/g, '¿');
content = content.replace(/Â¡/g, '¡');

// Catch those tricky ones with control characters/spaces
// ESTÃ  SEGURO -> ESTÁ SEGURO
// CATEGORÃ A -> CATEGORÍA
content = content.replace(/ESTÃ\s+SEGURO/g, 'ESTÁ SEGURO');
content = content.replace(/CATEGORÃ\s+A/g, 'CATEGORÍA');
content = content.replace(/categorÃ\s+a/g, 'categoría');
content = content.replace(/prÃ\s+ctica/g, 'práctica');
content = content.replace(/vÃ\s+lido/g, 'válido');
content = content.replace(/vÃ\s+lida/g, 'válida');
content = content.replace(/acciÃ\s+n/g, 'acción');
content = content.replace(/eliminarÃ\s+n/g, 'eliminarán');
content = content.replace(/OcurriÃ\s+n/g, 'Ocurrió');
content = content.replace(/borrarÃ\s+n/g, 'borrará');
content = content.replace(/RaÃ\s+z/g, 'Raíz');
content = content.replace(/raÃ\s+z/g, 'raíz');
content = content.replace(/huÃ\s+rfanos/g, 'huérfanos');
content = content.replace(/PROTECCIÃ\s+N/g, 'PROTECCIÓN');
content = content.replace(/deberÃ\s+a/g, 'debería');
content = content.replace(/razÃ\s+n/g, 'razón');
content = content.replace(/crÃ\s+tico/g, 'crítico');
content = content.replace(/GestiÃ\s+n/g, 'Gestión');
content = content.replace(/ConfiguraciÃ\s+n/g, 'Configuración');
content = content.replace(/OtorrinolaringÃ\s+logo/g, 'Otorrinolaringólogo');
content = content.replace(/SimulaciÃ\s+n/g, 'Simulación');
content = content.replace(/anÃ\s+lisis/g, 'análisis');
content = content.replace(/quÃ\s+/g, 'qué'); // Careful with this one
content = content.replace(/liberarÃ\s+n/g, 'liberará');
content = content.replace(/MigraciÃ\s+n/g, 'Migración');
content = content.replace(/Ã\s+til/g, 'Útil');
content = content.replace(/MÃ\s+dico/g, 'Médico');
content = content.replace(/SecretarÃ\s+a/g, 'Secretaría');
content = content.replace(/utilizarÃ\s+n/g, 'utilizará');
content = content.replace(/FibroscopÃ\s+a/g, 'Fibroscopía');
content = content.replace(/LÃ\s+nea/g, 'Línea');
content = content.replace(/lÃ\s+nea/g, 'línea');
content = content.replace(/ContraseÃ\s+a/g, 'Contraseña');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed AdminPage.jsx encoding');
