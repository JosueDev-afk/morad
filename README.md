# MORAD — Plataforma de Agendamiento para Fisioterapeutas

MORAD es una aplicación de agendamiento y gestión clínica para centros de fisioterapia. Está estructurada bajo una arquitectura limpia (Clean Architecture) y con mejores prácticas en desarrollo backend (FastAPI, SQLAlchemy, Alembic) y frontend (React, TypeScript, Vite, TanStack Query, TailwindCSS, shadcn/ui).

---

## Estructura del Proyecto

```
morad/
├── backend/            # API en FastAPI
│   ├── app/            # Código de la aplicación
│   │   ├── models/     # Modelos SQLAlchemy
│   │   ├── routers/    # Controladores API y Rutas
│   │   ├── schemas/    # Modelos Pydantic para validación
│   │   ├── services/   # Capa de lógica de negocio (servicios)
│   │   └── seed.py     # Script para poblar base de datos local
│   └── tests/          # Suite de pruebas automatizadas (pytest)
└── frontend/           # Interfaz React con TypeScript y Vite
    ├── src/
    │   ├── api/        # Clientes e integraciones de API (Axios)
    │   ├── components/ # Componentes reutilizables
    │   ├── pages/      # Vistas / Páginas de la aplicación
    │   └── store/      # Manejo de estado (Zustand)
```

---

## Requisitos Previos

- Python 3.9+
- Node.js 18+ y npm
- Docker

---

## Ejecución Rápida con Docker Compose

Puedes levantar y probar toda la plataforma (frontend, backend y base de datos con migraciones y seed automático) ejecutando un solo comando en la raíz del proyecto:

```bash
docker compose up --build
```

Esto levantará los siguientes servicios:
- **Base de datos (PostgreSQL)** en el puerto `5432`.
- **Backend (FastAPI)** en el puerto `8000` (con migraciones Alembic y seed inicial ejecutándose de forma automática al iniciar).
- **Frontend (React/Vite)** en el puerto `5173`.

Puedes acceder a la interfaz web en: [http://localhost:5173](http://localhost:5173).

---

## Configuración y Ejecución Manual (Entorno Local)

### 1. Iniciar Base de Datos Local
Si tienes Docker, puedes levantar una instancia de PostgreSQL lista para desarrollo en el puerto `5432`:
```bash
docker compose up -d
```

### 2. Configurar Entorno Virtual e Instalar Dependencias
Entra al directorio del backend, crea el entorno virtual e instala los paquetes:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Ejecutar Migraciones Alembic
Aplica los cambios del esquema a la base de datos:
```bash
alembic upgrade head
```

### 4. Poblar la Base de Datos (Seed)
Ejecuta el script de seed para cargar datos de prueba (administrador, terapeutas, pacientes, slots de disponibilidad y citas previas):
```bash
PYTHONPATH=. python app/seed.py
```

### 5. Iniciar el Servidor de Desarrollo
Corre la API localmente:
```bash
uvicorn app.main:app --reload
```
La API estará disponible en [http://localhost:8000](http://localhost:8000).

### 6. Ejecutar Suite de Pruebas
Corre la batería de tests automatizados (tests de modelos, autenticación, slots y ciclo de citas):
```bash
pytest
```

---

## Configuración y Ejecución del Frontend

### 1. Instalar Dependencias
Entra a la carpeta del frontend e instala las librerías necesarias:
```bash
cd frontend
npm install
```

### 2. Iniciar el Servidor de Desarrollo
Corre la aplicación local:
```bash
npm run dev
```
El portal de usuario estará disponible en [http://localhost:5173](http://localhost:5173).

---

## Credenciales de Acceso (Datos Seed)

Puedes iniciar sesión en la aplicación con las siguientes cuentas de prueba:

| Rol | Correo Electrónico | Contraseña | Notas |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@morad.com` | `adminpassword` | Gestión total de slots, reportes y métricas |
| **Terapeuta 1** | `terapeuta1@morad.com` | `therapistpassword` | Agenda de Laura Gomez (Fisioterapia Deportiva) |
| **Terapeuta 2** | `terapeuta2@morad.com` | `therapistpassword` | Agenda de Carlos Perez (Kinesiología) |
| **Paciente 1** | `paciente1@example.com` | `patientpassword` | Cuenta de Juan Garcia |
| **Paciente 2** | `paciente2@example.com` | `patientpassword` | Cuenta de Maria Rodriguez |
