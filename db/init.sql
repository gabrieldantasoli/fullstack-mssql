SET NOCOUNT ON;
GO

-- 1) Cria o banco se não existir (CREATE DATABASE via EXEC é mais seguro)
IF DB_ID(N'appdb') IS NULL
BEGIN
  EXEC(N'CREATE DATABASE appdb');
END
GO

-- 2) Entra no banco
USE appdb;
GO

-- 3) users
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    nome NVARCHAR(150) NOT NULL,
    login NVARCHAR(100) NOT NULL,
    senha NVARCHAR(255) NOT NULL,
    CONSTRAINT UQ_users_login UNIQUE (login)
  );
END
GO

-- 4) gabinete (FK -> users)
IF OBJECT_ID(N'dbo.gabinete', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.gabinete (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_gabinete PRIMARY KEY,
    nome NVARCHAR(150) NOT NULL,
    descricao NVARCHAR(500) NULL,
    user_id INT NOT NULL,
    CONSTRAINT FK_gabinete_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
  );
END
GO

-- 5) acesso (enum via lookup table)
IF OBJECT_ID(N'dbo.acesso', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.acesso (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_acesso PRIMARY KEY,
    nome NVARCHAR(20) NOT NULL,
    CONSTRAINT UQ_acesso_nome UNIQUE (nome),
    CONSTRAINT CK_acesso_nome CHECK (nome IN ('viewer', 'editor', 'admin'))
  );
END
GO

-- seed de acesso
IF NOT EXISTS (SELECT 1 FROM dbo.acesso WHERE nome = 'viewer')
  INSERT INTO dbo.acesso (nome) VALUES ('viewer');

IF NOT EXISTS (SELECT 1 FROM dbo.acesso WHERE nome = 'editor')
  INSERT INTO dbo.acesso (nome) VALUES ('editor');

IF NOT EXISTS (SELECT 1 FROM dbo.acesso WHERE nome = 'admin')
  INSERT INTO dbo.acesso (nome) VALUES ('admin');
GO

-- 6) solicitacao (FKs -> users, gabinete, acesso)
IF OBJECT_ID(N'dbo.solicitacao', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.solicitacao (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_solicitacao PRIMARY KEY,
    user_id INT NOT NULL,
    gabinete_id INT NOT NULL,
    atendido INT NULL,
    acesso_id INT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_solicitacao_created DEFAULT (SYSDATETIME()),

    CONSTRAINT FK_solicitacao_users
      FOREIGN KEY (user_id) REFERENCES dbo.users(id),

    CONSTRAINT FK_solicitacao_gabinete
      FOREIGN KEY (gabinete_id) REFERENCES dbo.gabinete(id),

    CONSTRAINT FK_solicitacao_acesso
      FOREIGN KEY (acesso_id) REFERENCES dbo.acesso(id),

    CONSTRAINT UQ_solicitacao_user_gabinete UNIQUE (user_id, gabinete_id)
  );
END
GO

/* -----------------------------
   status_evento (ENUM)
   - (corrigi o enum: processado no lugar do duplicado)
-------------------------------- */
IF OBJECT_ID(N'dbo.status_evento', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.status_evento (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_status_evento PRIMARY KEY,
    nome NVARCHAR(40) NOT NULL CONSTRAINT UQ_status_evento_nome UNIQUE,
    CONSTRAINT CK_status_evento_nome CHECK (nome IN ('processando', 'processado', 'aguardando_processamento'))
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.status_evento WHERE nome = 'processando')
  INSERT INTO dbo.status_evento (nome) VALUES ('processando');
IF NOT EXISTS (SELECT 1 FROM dbo.status_evento WHERE nome = 'processado')
  INSERT INTO dbo.status_evento (nome) VALUES ('processado');
IF NOT EXISTS (SELECT 1 FROM dbo.status_evento WHERE nome = 'aguardando_processamento')
  INSERT INTO dbo.status_evento (nome) VALUES ('aguardando_processamento');
GO

/* -----------------------------
   status_arquivo (ENUM)
-------------------------------- */
IF OBJECT_ID(N'dbo.status_arquivo', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.status_arquivo (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_status_arquivo PRIMARY KEY,
    nome NVARCHAR(40) NOT NULL CONSTRAINT UQ_status_arquivo_nome UNIQUE,
    CONSTRAINT CK_status_arquivo_nome CHECK (nome IN ('entregue', 'processando', 'processado'))
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.status_arquivo WHERE nome = 'entregue')
  INSERT INTO dbo.status_arquivo (nome) VALUES ('entregue');
IF NOT EXISTS (SELECT 1 FROM dbo.status_arquivo WHERE nome = 'processando')
  INSERT INTO dbo.status_arquivo (nome) VALUES ('processando');
IF NOT EXISTS (SELECT 1 FROM dbo.status_arquivo WHERE nome = 'processado')
  INSERT INTO dbo.status_arquivo (nome) VALUES ('processado');
GO

/* -----------------------------
   procurador
-------------------------------- */
IF OBJECT_ID(N'dbo.procurador', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.procurador (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_procurador PRIMARY KEY,
    nome NVARCHAR(150) NOT NULL
  );
END
GO

/* -----------------------------
   arquivo
   - SQL Server não tem tipo "arquivo.pdf/arquivo.txt"
     então:
     pdf = VARBINARY(MAX) (conteúdo binário)
     txt = NVARCHAR(MAX) (texto extraído)
-------------------------------- */
IF OBJECT_ID(N'dbo.arquivo', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.arquivo (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_arquivo PRIMARY KEY,

    pdf VARBINARY(MAX) NULL,
    txt NVARCHAR(MAX) NULL,

    nome_processo NVARCHAR(255) NOT NULL,
    descricao NVARCHAR(1000) NULL,

    status_arquivo_id INT NOT NULL,
    gabinete_id INT NOT NULL,

    created_at DATETIME2 NOT NULL CONSTRAINT DF_arquivo_created DEFAULT (SYSDATETIME()),

    CONSTRAINT FK_arquivo_status_arquivo
      FOREIGN KEY (status_arquivo_id) REFERENCES dbo.status_arquivo(id),

    CONSTRAINT FK_arquivo_gabinete
      FOREIGN KEY (gabinete_id) REFERENCES dbo.gabinete(id)
  );
END
GO

/* -----------------------------
   metadado (1-n: arquivo -> metadado)
-------------------------------- */
IF OBJECT_ID(N'dbo.metadado', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.metadado (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_metadado PRIMARY KEY,
    nome NVARCHAR(200) NOT NULL,
    valor NVARCHAR(MAX) NULL,
    arquivo_id INT NOT NULL,

    CONSTRAINT FK_metadado_arquivo
      FOREIGN KEY (arquivo_id) REFERENCES dbo.arquivo(id),

    CONSTRAINT UQ_metadado_arquivo_nome UNIQUE (arquivo_id, nome)
  );
END
GO

/* -----------------------------
   evento
   Relações:
   - evento -> arquivo (n-1): vários eventos para 1 arquivo
   - evento -> status_evento (cada evento tem 1 status)
   - procurador-evento (1-1): um evento tem 1 procurador e um procurador só pode estar em 1 evento
-------------------------------- */
IF OBJECT_ID(N'dbo.evento', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.evento (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_evento PRIMARY KEY,
    nome NVARCHAR(200) NOT NULL,

    arquivo_id INT NOT NULL,
    status_evento_id INT NOT NULL,

    procurador_id INT NOT NULL, -- 1-1 com procurador via UNIQUE

    created_at DATETIME2 NOT NULL CONSTRAINT DF_evento_created DEFAULT (SYSDATETIME()),

    CONSTRAINT FK_evento_arquivo
      FOREIGN KEY (arquivo_id) REFERENCES dbo.arquivo(id),

    CONSTRAINT FK_evento_status_evento
      FOREIGN KEY (status_evento_id) REFERENCES dbo.status_evento(id),

    CONSTRAINT FK_evento_procurador
      FOREIGN KEY (procurador_id) REFERENCES dbo.procurador(id),

    CONSTRAINT UQ_evento_procurador UNIQUE (procurador_id)
  );
END
GO

/* -----------------------------
   pages
   - você pediu int[]; SQL Server não tem array nativo
     então armazeno como JSON: ex. "[1,2,3]"
   Relações:
   - procurador-pages (1-1)
   - evento-pages (1-1)
   Implementação:
   - pages pode pertencer OU a um procurador OU a um evento (XOR)
   - e cada procurador/evento pode ter no máximo 1 pages (índices únicos filtrados)
-------------------------------- */
IF OBJECT_ID(N'dbo.pages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pages (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pages PRIMARY KEY,

    pages_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_pages_json DEFAULT (N'[]'),
    CONSTRAINT CK_pages_json_isjson CHECK (ISJSON(pages_json) = 1),

    procurador_id INT NULL,
    evento_id INT NULL,

    CONSTRAINT FK_pages_procurador
      FOREIGN KEY (procurador_id) REFERENCES dbo.procurador(id),

    CONSTRAINT FK_pages_evento
      FOREIGN KEY (evento_id) REFERENCES dbo.evento(id),

    -- XOR: pertence a exatamente um dos dois
    CONSTRAINT CK_pages_owner
      CHECK (
        (procurador_id IS NOT NULL AND evento_id IS NULL)
        OR
        (procurador_id IS NULL AND evento_id IS NOT NULL)
      )
  );
END
GO

-- Índices únicos filtrados para garantir 1-1 (SQL Server: precisa ser índice, não constraint)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_pages_procurador' AND object_id = OBJECT_ID(N'dbo.pages'))
BEGIN
  CREATE UNIQUE INDEX UX_pages_procurador ON dbo.pages(procurador_id) WHERE procurador_id IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_pages_evento' AND object_id = OBJECT_ID(N'dbo.pages'))
BEGIN
  CREATE UNIQUE INDEX UX_pages_evento ON dbo.pages(evento_id) WHERE evento_id IS NOT NULL;
END
GO





--  PROCEDURES:
USE appdb;
GO
/* =========================================================
   PROCEDURE: criar usuário (insert) e retornar o ID criado
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_users_create
  @nome  NVARCHAR(150),
  @login NVARCHAR(100),
  @senha NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;

  IF @nome IS NULL OR LTRIM(RTRIM(@nome)) = N''
    THROW 50001, 'nome é obrigatório', 1;

  IF @login IS NULL OR LTRIM(RTRIM(@login)) = N''
    THROW 50002, 'login é obrigatório', 1;

  IF @senha IS NULL OR LTRIM(RTRIM(@senha)) = N''
    THROW 50003, 'senha é obrigatória', 1;

  IF EXISTS (SELECT 1 FROM dbo.users WHERE login = @login)
    THROW 50004, 'login já existe', 1;

  INSERT INTO dbo.users (nome, login, senha)
  VALUES (@nome, @login, @senha);

  DECLARE @new_id INT = SCOPE_IDENTITY();

  SELECT id, nome, login
  FROM dbo.users
  WHERE id = @new_id;
END
GO

/* =========================================================
   PROCEDURE: buscar usuário por ID
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_users_get_by_id
  @id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @id IS NULL OR @id <= 0
    THROW 50005, 'id inválido', 1;

  SELECT id, nome, login
  FROM dbo.users
  WHERE id = @id;
END
GO
