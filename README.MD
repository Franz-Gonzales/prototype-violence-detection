# **PROYECTO DE IA-3 VIOLENCE DETECTION**
violence-detector/
│
├── backend/
│   ├── app/
│   │   ├── init.py
│   │   ├── main.py                    # Punto de entrada
│   │   ├── config.py                  # Configuración global
│   │   ├── models/                    # Modelos de datos y ORM
│   │   │   ├── init.py
│   │   │   ├── database.py
│   │   │   └── schema.py              # Esquemas combinados
│   │   ├── api/                       # API endpoints
│   │   │   ├── init.py
│   │   │   ├── router.py              # Router centralizado
│   │   │   └── endpoints.py           # Todos los endpoints en un archivo
│   │   ├── ai/                        # Modelos de IA
│   │   │   ├── init.py
│   │   │   ├── detector.py            # YOLO
│   │   │   ├── tracker.py             # DeepSORT
│   │   │   ├── classifier.py          # TimeSformer
│   │   │   └── pipeline.py            # Integración completa
│   │   ├── video/                     # Procesamiento de video
│   │   │   ├── init.py
│   │   │   ├── camera.py              # IP Webcam connector
│   │   │   └── processor.py           # Frame processing
│   │   └── utils/                     # Utilidades
│   │       ├── init.py
│   │       └── helpers.py             # Funciones auxiliares
│   ├── weights/                       # Modelos pre-entrenados
│   │   ├── yolo11_people_final.onnx
│   │   ├── deepsort.onnx
│   │   └── timesformer_final.onnx
│   ├── data/                          # Datos
│   │   ├── db.sqlite                  # Base de datos
│   │   └── clips/                     # Clips de incidentes
│   ├── requirements.txt               # Dependencias
│   └── .env                           # Variables de entorno
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx                    # Componente principal
│   │   ├── index.jsx                  # Punto de entrada
│   │   ├── components/
│   │   │   ├── Layout.jsx             # Layout principal
│   │   │   ├── VideoStream.jsx        # Visualización de video
│   │   │   ├── IncidentList.jsx       # Lista de incidentes
│   │   │   ├── Notifications.jsx      # Panel de notificaciones
│   │   │   └── common/                # Componentes reutilizables
│   │   │       ├── Button.jsx
│   │   │       └── Card.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx               # Dashboard principal
│   │   │   └── Incidents.jsx          # Historial de incidentes
│   │   ├── store/                     # Estado global con Zustand
│   │   │   ├── useStreamStore.js
│   │   │   └── useIncidentsStore.js
│   │   └── utils/
│   │       ├── api.js                 # Cliente API
│   │       └── socket.js              # Configuración de Socket.IO
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── README.md                          # Documentación


{
  "name": "violence-detector-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "axios": "^1.9.0",
    "date-fns": "^4.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-feather": "^2.0.10",
    "react-hot-toast": "^2.5.2",
    "react-router-dom": "^7.6.0",
    "socket.io-client": "^4.8.1",
    "zustand": "^5.0.4"
  },
  "devDependencies": {
    "@types/react": "^19.1.3",
    "@types/react-dom": "^19.1.3",
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.21",
    "eslint": "^9.26.0",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "postcss": "^8.5.3",
    "tailwindcss": "^4.1.6",
    "vite": "^6.3.5"
  }
}


## Modelos de IA

El sistema utiliza los siguientes modelos:

1. **YOLOv11**: Modelo entrenado para detección de personas, exportado en formato ONNX.
   - Ubicación: `weights/yolo11_people_final.onnx`

2. **DeepSORT**: Implementado utilizando la biblioteca `deep-sort-realtime`, que incluye modelos pre-entrenados para extracción de características (no requiere un modelo ONNX separado).

3. **TimeSformer**: Modelo entrenado para clasificación de violencia, exportado en formato ONNX.
   - Ubicación: `weights/timesformer_final.onnx`


# Windows
- python -m venv venv
- venv\Scripts\activate

# Desde el directorio backend
- python -m app.main

- set PYTHONPATH=C:\GONZALES\Proyecto-IA3\prototype-violence-detection\backend
- python -m app.main

# Para borrar caché
Remove-Item -Recurse -Force .\app\__pycache__\
Remove-Item -Recurse -Force .\app\*\__pycache__\

### Reinicia el entorno virtual:
deactivate
.\venv\Scripts\activate

Limpia la caché de pip:
- pip cache purge


# Para borrar el caché del front
- npm cache clean --force
- npm cache clean --force