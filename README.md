# Vértice Disciplina

PWA personal para construir disciplina con metas, calendario, rachas, ideas y estadísticas.

## V2
- Inicio con 3 victorias diarias
- Objetivos semanales editables y reinicio automático por semana
- Metas con prioridad, fecha límite y categorías
- Calendario mensual y tareas por día
- Rachas con cálculo real por fechas
- Bloc de ideas con detección local de posibles metas
- Estadísticas de 7 días e historial semanal
- PWA offline instalable
- Recordatorio diario mediante archivo de calendario (.ics)
- Sincronización opcional celular/PC mediante Firebase Auth + Firestore
- Exportación/importación de copia JSON

## Activar sincronización
1. Crear un proyecto de Firebase.
2. Activar Authentication > Email/Password.
3. Crear Firestore Database.
4. Publicar las reglas de `firestore.rules`.
5. Copiar la configuración Web del proyecto.
6. En Vértice > Ajustes, pegarla como JSON y pulsar **Guardar configuración**.
7. Crear una cuenta/iniciar sesión con el mismo correo en el celular y la computadora.

Los datos locales siguen funcionando aunque Firebase no esté configurado.
