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
