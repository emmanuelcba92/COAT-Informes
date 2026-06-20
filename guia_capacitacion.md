# Guía de Capacitación: WebApp Informes COAT
Esta guía interactiva está diseñada para ayudarte a liderar la capacitación de los profesionales médicos y fonoaudiólogos mañana. Cubre los puntos clave, el flujo de trabajo recomendado y las características "mágicas" que les ahorrarán tiempo en su día a día.

---

## 📋 Estructura y Cronograma Sugerido de la Reunión (45-60 min)

1. **Introducción y Propósito (5 min)**
   - Explicar qué es la WebApp: una plataforma unificada para agilizar la redacción de informes médicos, la generación de pedidos/recetas de estudios, y el envío automático de PDFs tanto a administración como a los pacientes por correo electrónico.
   - Objetivo: Reducir a cero la carga administrativa manual y estandarizar la documentación de la clínica.

2. **Demostración de un Flujo Completo: Generación de un Informe (15 min)**
   - Mostrar cómo crear un informe desde cero.
   - **El truco de magia 1:** Autocompletado de paciente ingresando solo el DNI.
   - **El truco de magia 2:** Pegar una captura de pantalla (Ctrl+V) con datos de WhatsApp/Email para rellenar el formulario usando Inteligencia Artificial.
   - Selección de la práctica médica y carga automática del texto plantilla.
   - Edición rápida en el editor de texto enriquecido.
   - Generación de la vista previa, descarga del PDF y envío por correo con firma digital integrada.

3. **Demostración: Generación de Pedidos/Prescripciones (10 min)**
   - Selección de tipo de pedido (prácticas auditivas, etc.).
   - Selección múltiple de prácticas, cantidades e indicaciones.
   - Descarga y envío por correo electrónico.

4. **Configuración de Perfil y Plantillas Propias (10 min)**
   - Cómo verificar que su firma digital esté cargada.
   - Configuración de membretes personalizados.
   - **"Mis Modelos":** Cómo personalizar las plantillas predeterminadas de cada estudio para que se cargue su propio texto y no el general del centro.

5. **Preguntas, Respuestas y Cierre (10 min)**

---

## 💡 Puntos Clave que Debes Destacar (¡Los "Wow Factors"!)

### 1. El Autocompletado Inteligente por DNI
- **Cómo funciona:** Al escribir el DNI del paciente (7 a 9 dígitos) y esperar un segundo, el sistema busca en la base de datos histórica. Si el paciente ya asistió alguna vez, carga automáticamente su **Nombre**, su **Obra Social** y su **Correo Electrónico**.
- **Beneficio:** Evita errores de ortografía en los nombres y ahorra tipear datos repetitivos.

### 2. Pegado Directo con IA (¡La Estrella de la Demo!)
- **Cómo funciona:** Si el profesional recibe los datos del paciente o la derivación por WhatsApp web o correo, puede hacer una captura de pantalla (ej. usando la herramienta de recortes), hacer clic sobre la página de la WebApp y presionar **Ctrl + V** (Pegar).
- **Detalle técnico:** El sistema envía la imagen a un motor de Inteligencia Artificial que extrae el DNI, Nombre, Obra Social e Email e ingresa todo en los campos correspondientes al instante.
- **Beneficio:** Cero transcripción manual. ¡Es ideal para demostrarlo en vivo!

### 3. Personalización de Plantillas ("Mis Modelos")
- Cada profesional redacta de forma distinta. En la pestaña **Mis Modelos** (o en `/reports/models`), cada usuario puede editar el texto por defecto de las prácticas de su especialidad.
- Una vez personalizado, cuando ese profesional cree un informe y seleccione la práctica (ej. *Rinofaringolaringofibroscopia*), el sistema cargará **su plantilla editada** en vez de la plantilla genérica de la clínica.

### 4. Firma Digital Automatizada
- En el perfil de cada usuario está guardada su firma en formato digital.
- Al generar el PDF, la firma y el sello se insertan de manera automática al final del documento. Ya no es necesario imprimir, firmar físicamente, escanear y enviar.

### 5. Envío en un Clic
- El botón **Enviar por Email** hace tres cosas en segundo plano:
  1. Genera el PDF final.
  2. Le envía un correo formal y prolijo al paciente con el PDF adjunto.
  3. Envía una copia del PDF al correo de administración y lo guarda en las carpetas correspondientes en Google Drive (si está configurado).

---

## 🛠️ Guión de Paso a Paso para la Presentación

### Paso 1: Inicio de Sesión y Perfil
* "Buenos días a todos. Hoy vamos a conocer la plataforma para optimizar el flujo de informes y pedidos de COAT..."
* Entra con tu cuenta o una de prueba. Ve a **Mi Perfil**.
* Muestra dónde está el nombre, especialidad, matrícula y la **firma digital**. Explica la importancia de que estos datos estén correctos, ya que es lo que aparece al pie de cada informe.

### Paso 2: Crear un Informe (Caso 1 - Paciente Nuevo con IA)
* Ve a **Informes -> Generar Informe**.
* Di: *"Imaginen que les mandaron por WhatsApp los datos de un paciente. En vez de escribirlos uno por uno..."*
* (Prepara una imagen o captura de texto simulado de un paciente que tenga Nombre, DNI, Obra Social). Copia esa imagen al portapapeles.
* Haz clic en la pantalla de la WebApp y presiona **Ctrl + V**.
* Deja que procese 3 segundos y muestra cómo se autocompleta el formulario.
* Di: *"La IA ha extraído el DNI, el Nombre y la Obra Social. Ahora solo seleccionamos la práctica."*

### Paso 3: Selección de Práctica y Edición
* Selecciona una práctica en el menú desplegable (por ejemplo, *Rinofaringolaringofibroscopia* o la que uses de test).
* Muestra cómo se rellena el cuadro del editor con el informe estándar.
* Modifica alguna palabra para demostrar que se puede editar libremente en tiempo real (negrita, viñetas, etc.).
* Activa/desactiva la casilla de "Incluir Título" o "Habilitar Membrete" si el usuario tiene habilitado.

### Paso 4: Generación y Envío
* Haz clic en **Vista Previa** para mostrarles cómo quedará el PDF final (con membrete arriba, datos compactos, texto formateado y firma/sello al final).
* Explica: *"Si hacemos clic en 'Descargar PDF', se guarda en la computadora y el paciente ya queda registrado en el historial. Pero si hacemos clic en 'Enviar por Email', el sistema le envía el PDF directamente al correo del paciente y envía una copia a administración para el cobro o archivo."*

### Paso 5: Gestión de Modelos Propios
* Ve a **Informes -> Mis Modelos** (o en la barra de pestañas superior).
* Muestra cómo un médico puede seleccionar una práctica, ver la plantilla genérica, modificarla a su gusto (por ejemplo, agregar sus frases más usadas) y presionar "Guardar".
* Vuelve a la pestaña de crear informe, selecciona la misma práctica y muestra cómo ahora se carga la versión personalizada de ese profesional.

---

## 💡 Preguntas Frecuentes de los Profesionales (Y cómo responderlas)

* **¿Qué pasa si el paciente no tiene correo electrónico?**
  * *Respuesta:* Se puede tildar la opción "Omitir envío por email" o dejar el campo vacío. El sistema descargará el PDF en tu computadora y registrará al paciente, pero no intentará enviar correos.
* **¿Cómo cargo mi firma si no está o si quiero cambiarla?**
  * *Respuesta:* En **Mi Perfil** se puede subir la imagen de la firma (preferentemente sobre fondo blanco o transparente). El sistema se encarga de recortarla y centrarla automáticamente para que quede perfecta en el PDF.
* **¿Las secretarias pueden hacer informes?**
  * *Respuesta:* Las secretarias tienen permisos especiales para ver el historial y ayudar en la gestión de turnos/pacientes, pero por seguridad y autoría médica, solo los profesionales y directores pueden firmar y emitir informes clínicos. Sin embargo, existe la **Delegación de Autoría**: una supersecretaria o director puede rellenar un informe *a nombre de* otro profesional si este lo autoriza, seleccionándolo en el menú superior de delegación.
* **¿Se guardan los informes por si los tengo que corregir?**
  * *Respuesta:* Sí, en la pestaña **Historial** (dentro de informes o pedidos) se pueden ver todos los documentos emitidos, buscarlos por nombre o DNI del paciente, reabrirlos para editarlos o volver a imprimirlos.

---

¡Mucho éxito en la capacitación de mañana! Ten la seguridad de que la herramienta está construida sobre bases sólidas de usabilidad, y ver en vivo la extracción por IA y el autocompletado les va a encantar.
