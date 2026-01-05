# 🐍 Guia de Integração Django REST Framework

> Como adicionar Django REST Framework ao backend do Obras Wise

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura Proposta](#estrutura-proposta)
3. [Instalação e Configuração](#instalação-e-configuração)
4. [Migração das APIs](#migração-das-apis)
5. [Autenticação JWT](#autenticação-jwt)
6. [Integração com Supabase](#integração-com-supabase)
7. [Vantagens e Desvantagens](#vantagens-e-desvantagens)

---

## 🎯 Visão Geral

### Estado Atual

**Backend:** Next.js API Routes (TypeScript)
```
web/src/app/api/
├── auth/login/route.ts
├── obras/route.ts
├── admin/users/route.ts
└── ...
```

**Banco de Dados:** Supabase (PostgreSQL)

### Proposta com Django

**Backend:** Django REST Framework (Python)
```
backend/
├── api/
│   ├── views.py
│   ├── serializers.py
│   └── urls.py
├── obras/
│   ├── models.py
│   ├── views.py
│   └── serializers.py
└── manage.py
```

---

## 🏗️ Estrutura Proposta

```
obras-wise-mobile/
├── web/                        # Frontend Next.js (mantém)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (tabs)/        # Páginas
│   │   │   └── api/           # ❌ REMOVER após migração
│   │   └── lib/
│   │       └── api-client.ts  # ✅ Cliente HTTP para Django
│   └── package.json
├── backend/                    # ✅ NOVO: Django REST Framework
│   ├── config/                # Configurações do projeto
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── api/                   # App principal de API
│   │   ├── urls.py
│   │   ├── permissions.py
│   │   └── middleware.py
│   ├── obras/                 # App de Obras
│   │   ├── models.py          # Modelos (se necessário)
│   │   ├── views.py           # ViewSets
│   │   ├── serializers.py     # Serializers
│   │   └── urls.py
│   ├── users/                 # App de Usuários
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── equipes/               # App de Equipes
│   │   └── ...
│   ├── manage.py
│   ├── requirements.txt
│   └── .env
├── mobile/                    # React Native (mantém)
└── docs/
```

---

## 📦 Instalação e Configuração

### 1. Criar Projeto Django

```bash
# Ir para a raiz do projeto
cd c:/Users/Mateus\ Almeida/obras-wise-mobile

# Criar ambiente virtual
python -m venv backend/venv

# Ativar ambiente (Windows)
backend\venv\Scripts\activate

# Ativar ambiente (Linux/Mac)
source backend/venv/bin/activate

# Instalar dependências
pip install django djangorestframework
pip install djangorestframework-simplejwt
pip install django-cors-headers
pip install psycopg2-binary  # PostgreSQL
pip install python-decouple   # Variáveis de ambiente
pip install supabase         # Cliente Supabase
```

### 2. Criar Projeto

```bash
# Criar projeto Django
django-admin startproject config backend
cd backend

# Criar apps
python manage.py startapp obras
python manage.py startapp users
python manage.py startapp equipes
python manage.py startapp api
```

### 3. Configurar `requirements.txt`

```txt
Django==5.0.1
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.1
django-cors-headers==4.3.1
psycopg2-binary==2.9.9
python-decouple==3.8
supabase==2.0.0
```

### 4. Configurar `settings.py`

```python
# config/settings.py
from decouple import config

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local apps
    'api',
    'obras',
    'users',
    'equipes',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CORS (primeiro)
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS (permitir Next.js acessar)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://192.168.0.3:3000",  # Seu IP local
]

CORS_ALLOW_CREDENTIALS = True

# Database (Supabase PostgreSQL)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}
```

### 5. Configurar `.env`

```env
# backend/.env
SECRET_KEY=sua-chave-secreta-aqui
DEBUG=True

# Database Supabase
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=sua-senha-supabase
DB_HOST=db.seu-projeto.supabase.co
DB_PORT=5432

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-service-role-key
```

---

## 🔌 Migração das APIs

### Exemplo: API de Obras

#### ❌ Antes (Next.js API Route)

```typescript
// web/src/app/api/obras/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
```

#### ✅ Depois (Django REST Framework)

**1. Serializer**
```python
# backend/obras/serializers.py
from rest_framework import serializers

class ObraSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    obra = serializers.CharField(max_length=10)
    responsavel = serializers.CharField(max_length=100)
    equipe = serializers.CharField(max_length=50)
    tipo_servico = serializers.CharField(max_length=100)
    data = serializers.DateField()
    status = serializers.CharField(max_length=20)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
```

**2. View**
```python
# backend/obras/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from decouple import config
from .serializers import ObraSerializer

class ObraViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.supabase = create_client(
            config('SUPABASE_URL'),
            config('SUPABASE_KEY')
        )

    def list(self, request):
        """GET /api/obras/"""
        try:
            response = self.supabase.table('obras')\
                .select('*')\
                .order('created_at', desc=True)\
                .execute()

            serializer = ObraSerializer(response.data, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """POST /api/obras/"""
        try:
            serializer = ObraSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'success': False,
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            response = self.supabase.table('obras')\
                .insert(serializer.validated_data)\
                .execute()

            return Response({
                'success': True,
                'data': response.data[0]
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, pk=None):
        """GET /api/obras/{id}/"""
        try:
            response = self.supabase.table('obras')\
                .select('*')\
                .eq('id', pk)\
                .single()\
                .execute()

            serializer = ObraSerializer(response.data)
            return Response({
                'success': True,
                'data': serializer.data
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_404_NOT_FOUND)
```

**3. URLs**
```python
# backend/obras/urls.py
from rest_framework.routers import DefaultRouter
from .views import ObraViewSet

router = DefaultRouter()
router.register(r'obras', ObraViewSet, basename='obra')

urlpatterns = router.urls
```

**4. URLs Principais**
```python
# backend/config/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT Auth
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Apps
    path('api/', include('obras.urls')),
    path('api/', include('users.urls')),
    path('api/', include('equipes.urls')),
]
```

---

## 🔐 Autenticação JWT

### Backend (Django)

**Login retorna tokens:**
```json
POST /api/auth/login/
{
  "email": "user@example.com",
  "password": "senha123"
}

Response:
{
  "access": "eyJhbGc...",
  "refresh": "eyJhbGc..."
}
```

### Frontend (Next.js)

**Cliente API:**
```typescript
// web/src/lib/api-client.ts
const API_URL = 'http://localhost:8000/api'

export async function apiClient(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = localStorage.getItem('access_token')

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  }

  const response = await fetch(`${API_URL}${endpoint}`, config)

  // Se 401, tentar refresh
  if (response.status === 401) {
    const refreshed = await refreshToken()
    if (refreshed) {
      // Retry original request
      return apiClient(endpoint, options)
    } else {
      // Logout
      window.location.href = '/login'
    }
  }

  return response.json()
}

async function refreshToken() {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return false

  try {
    const response = await fetch('http://localhost:8000/api/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    })

    const data = await response.json()
    localStorage.setItem('access_token', data.access)
    return true
  } catch {
    return false
  }
}

// Usar nas páginas
export async function getObras() {
  return apiClient('/obras/')
}

export async function createObra(data: any) {
  return apiClient('/obras/', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
```

---

## 🔄 Integração com Supabase

### Opção 1: Django apenas como API (sem ORM)

✅ **Vantagem:** Não precisa duplicar schema
❌ **Desvantagem:** Perde validações e relacionamentos do Django

```python
# Usar cliente Supabase direto (como mostrado acima)
from supabase import create_client

class ObraViewSet(viewsets.ViewSet):
    def __init__(self):
        self.supabase = create_client(url, key)
```

### Opção 2: Django ORM + Supabase PostgreSQL

✅ **Vantagem:** Usa ORM do Django, migrações, admin panel
❌ **Desvantagem:** Precisa sincronizar schema

```python
# backend/obras/models.py
from django.db import models
import uuid

class Obra(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    obra = models.CharField(max_length=10)
    responsavel = models.CharField(max_length=100)
    equipe = models.CharField(max_length=50)
    tipo_servico = models.CharField(max_length=100)
    data = models.DateField()
    status = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'obras'  # Usar tabela existente do Supabase
        managed = False      # Django não cria/altera tabela
```

**View com ORM:**
```python
from rest_framework import viewsets
from .models import Obra
from .serializers import ObraSerializer

class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all().order_by('-created_at')
    serializer_class = ObraSerializer
    permission_classes = [IsAuthenticated]
```

**Serializer com Model:**
```python
from rest_framework import serializers
from .models import Obra

class ObraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Obra
        fields = '__all__'
```

---

## ⚙️ Rodar Django

```bash
# Ativar ambiente virtual
cd backend
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Rodar servidor (porta 8000)
python manage.py runserver

# Rodar em porta customizada
python manage.py runserver 8080

# Rodar acessível na rede
python manage.py runserver 0.0.0.0:8000
```

**Acessar:**
- API: http://localhost:8000/api/
- Admin: http://localhost:8000/admin/

---

## 🔄 Workflow Completo

### Desenvolvimento

1. **Backend (porta 8000):**
```bash
cd backend
venv\Scripts\activate
python manage.py runserver
```

2. **Frontend (porta 3000):**
```bash
cd web
npm run dev
```

3. **Mobile (Expo):**
```bash
cd mobile
npx expo start
```

### Produção

1. **Backend:** Deploy em Railway, Heroku, DigitalOcean
2. **Frontend:** Deploy em Vercel (Next.js)
3. **Mobile:** Expo EAS Build

---

## ⚖️ Vantagens e Desvantagens

### ✅ Vantagens do Django REST Framework

1. **Organização:** Código Python mais limpo que API Routes
2. **Admin Panel:** Interface gráfica para gerenciar dados
3. **ORM Poderoso:** QuerySets complexos facilmente
4. **Serializers:** Validação robusta de dados
5. **ViewSets:** Menos código para CRUD completo
6. **Ecosystem:** Bibliotecas maduras (celery, redis, etc)
7. **Permissões:** Sistema granular de permissões
8. **Documentação:** Auto-gerada com drf-spectacular

### ❌ Desvantagens do Django REST Framework

1. **Complexidade:** Mais setup inicial
2. **Deploy:** Precisa de servidor Python (mais caro)
3. **Dois Servidores:** Next.js (3000) + Django (8000)
4. **CORS:** Precisa configurar Cross-Origin
5. **Curva de Aprendizado:** Precisa saber Python + Django
6. **Overhead:** Para API simples, pode ser excessivo

---

## 🎯 Quando Usar Django?

### ✅ Use Django SE:

- Já conhece Python/Django
- API muito complexa (50+ endpoints)
- Precisa de Admin Panel
- Quer usar Celery (tarefas assíncronas)
- Precisa de ORM avançado
- Equipe prefere Python

### ❌ Mantenha Next.js SE:

- API simples (< 20 endpoints)
- Equipe só sabe TypeScript
- Quer deploy unificado (Vercel)
- Quer menos complexidade
- Supabase já resolve tudo

---

## 📚 Recursos

- **Django REST:** https://www.django-rest-framework.org/
- **Django Docs:** https://docs.djangoproject.com/
- **JWT:** https://django-rest-framework-simplejwt.readthedocs.io/
- **CORS:** https://github.com/adamchainz/django-cors-headers

---

## 💡 Recomendação Final

Para o **Obras Wise**, recomendo **MANTER Next.js API Routes** porque:

1. ✅ API atual é simples (CRUD básico)
2. ✅ Supabase já fornece ORM (JavaScript SDK)
3. ✅ Deploy unificado no Vercel
4. ✅ Menos infraestrutura para gerenciar
5. ✅ TypeScript end-to-end (type-safe)

**Django seria útil SE:** você precisasse de tarefas agendadas (celery), processamento pesado em background, ou admin panel complexo.

---

**Criado em:** Janeiro 2025
**Autor:** Claude Code
**Projeto:** Obras Wise - Sistema Web
