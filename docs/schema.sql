-- Предлагаемая схема PostgreSQL. Не выполняется статическим прототипом.
CREATE TABLE users (
  id uuid PRIMARY KEY,
  external_subject text UNIQUE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','user')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE centers (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE departments (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE articles (
  id uuid PRIMARY KEY,
  category text NOT NULL,
  center_id uuid REFERENCES centers,
  department_id uuid REFERENCES departments,
  current_version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE article_versions (
  article_id uuid NOT NULL REFERENCES articles,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body_json jsonb NOT NULL,
  body_html text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  change_note text NOT NULL,
  effective_from date NOT NULL,
  author_id uuid NOT NULL REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(article_id, version)
);
CREATE INDEX article_versions_effective ON article_versions(article_id, effective_from DESC, version DESC);
CREATE INDEX article_versions_search ON article_versions USING gin(to_tsvector('russian',title || ' ' || summary));
CREATE TABLE favorites (user_id uuid REFERENCES users, article_id uuid REFERENCES articles, PRIMARY KEY(user_id,article_id));
CREATE TABLE drafts (id uuid PRIMARY KEY, article_id uuid REFERENCES articles, user_id uuid NOT NULL REFERENCES users, content jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE attachments (id uuid PRIMARY KEY, article_id uuid REFERENCES articles, object_key text UNIQUE NOT NULL, mime_type text NOT NULL, size_bytes bigint NOT NULL, alt_text text, created_by uuid NOT NULL REFERENCES users);
CREATE TABLE audit_log (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES users, action text NOT NULL, resource_type text NOT NULL, resource_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
-- Секреты оборудования в эту базу не записываются.
CREATE TABLE employees (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  job_title text,
  department_id uuid REFERENCES departments,
  email text,
  personal_phone text,
  extension text,
  notes text NOT NULL DEFAULT '',
  notes_updated_at timestamptz,
  employment_status text NOT NULL DEFAULT 'active' CHECK(employment_status IN ('active','dismissed')),
  dismissed_at date,
  credential_reference text -- ID записи в корпоративном хранилище, не сам пароль
);
CREATE TABLE office_floors (
  id uuid PRIMARY KEY,
  center_id uuid NOT NULL REFERENCES centers,
  floor_number integer NOT NULL,
  name text NOT NULL,
  width integer NOT NULL CHECK(width BETWEEN 400 AND 6000),
  height integer NOT NULL CHECK(height BETWEEN 350 AND 6000),
  version integer NOT NULL DEFAULT 1,
  UNIQUE(center_id,floor_number)
);
CREATE TABLE office_rooms (
  id uuid PRIMARY KEY,
  floor_id uuid NOT NULL REFERENCES office_floors,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'teal',
  open_area boolean NOT NULL DEFAULT false,
  x integer NOT NULL CHECK(x >= 20), y integer NOT NULL CHECK(y >= 20),
  width integer NOT NULL CHECK(width BETWEEN 40 AND 5000), height integer NOT NULL CHECK(height BETWEEN 40 AND 5000),
  UNIQUE(id,floor_id)
);
CREATE TABLE office_workplaces (
  id uuid PRIMARY KEY,
  floor_id uuid NOT NULL REFERENCES office_floors,
  room_id uuid NOT NULL,
  seat_number text NOT NULL,
  employee_id uuid UNIQUE REFERENCES employees,
  pc_name text,
  extension text,
  phone_ip inet,
  printer_name text,
  printer_ip inet,
  printer_model text,
  x integer NOT NULL, y integer NOT NULL,
  FOREIGN KEY(room_id,floor_id) REFERENCES office_rooms(id,floor_id),
  UNIQUE(floor_id,seat_number)
);
-- Зоны — свободно названные прямоугольники; open_area разрешает соединённые проходы.
CREATE TABLE office_objects (
  id uuid PRIMARY KEY,
  floor_id uuid NOT NULL REFERENCES office_floors,
  room_id uuid,
  name text NOT NULL,
  kind text NOT NULL,
  color text NOT NULL,
  x integer NOT NULL, y integer NOT NULL,
  width integer NOT NULL CHECK(width BETWEEN 12 AND 1500),
  height integer NOT NULL CHECK(height BETWEEN 12 AND 1500),
  rotation integer NOT NULL DEFAULT 0 CHECK(rotation IN (0,90,180,270)),
  notes text NOT NULL DEFAULT '',
  ip inet,
  model text,
  FOREIGN KEY(room_id,floor_id) REFERENCES office_rooms(id,floor_id)
);
CREATE TABLE resource_records (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES users,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE resource_fields (
  id uuid PRIMARY KEY,
  record_id uuid NOT NULL REFERENCES resource_records,
  label text NOT NULL,
  position integer NOT NULL,
  masked boolean NOT NULL DEFAULT false,
  value_text text,
  secret_reference text,
  CHECK((masked AND value_text IS NULL AND secret_reference IS NOT NULL)
     OR (NOT masked AND secret_reference IS NULL))
);
-- Реальные секреты — по secret_reference через корпоративное хранилище, не в value_text.
