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

    procurador_id INT NULL,

    created_at DATETIME2 NOT NULL CONSTRAINT DF_evento_created DEFAULT (SYSDATETIME()),

    CONSTRAINT FK_evento_arquivo
      FOREIGN KEY (arquivo_id) REFERENCES dbo.arquivo(id),

    CONSTRAINT FK_evento_status_evento
      FOREIGN KEY (status_evento_id) REFERENCES dbo.status_evento(id),

    CONSTRAINT FK_evento_procurador
      FOREIGN KEY (procurador_id) REFERENCES dbo.procurador(id),
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
    evento_id INT NULL,

    CONSTRAINT FK_pages_evento
      FOREIGN KEY (evento_id) REFERENCES dbo.evento(id),

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

/* =========================================================
   SESSIONS (sessão no banco)
   ========================================================= */
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sessions (
    session_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_sessions PRIMARY KEY,
    user_id INT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_sessions_created DEFAULT (SYSDATETIME()),
    expires_at DATETIME2 NOT NULL,
    revoked_at DATETIME2 NULL,

    CONSTRAINT FK_sessions_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_sessions_user_id' AND object_id = OBJECT_ID(N'dbo.sessions')
)
BEGIN
  CREATE INDEX IX_sessions_user_id ON dbo.sessions(user_id);
END
GO

/* =========================================================
   PROCEDURE: LOGIN (busca por login OU nome)
   - recebe @senha para cumprir assinatura pedida,
     MAS a validação real ocorre na API (bcrypt).
   - retorna id, nome, login, senha(hash)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_auth_login
  @identifier NVARCHAR(100),
  @senha NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;

  IF @identifier IS NULL OR LTRIM(RTRIM(@identifier)) = N''
    THROW 50010, 'identifier é obrigatório', 1;

  DECLARE @cnt INT;

  -- 1) tenta por login (preferência)
  SELECT @cnt = COUNT(*)
  FROM dbo.users
  WHERE login = @identifier;

  IF @cnt = 1
  BEGIN
    SELECT TOP 1 id, nome, login, senha
    FROM dbo.users
    WHERE login = @identifier;
    RETURN;
  END

  -- 2) tenta por nome (pode ser ambíguo)
  SELECT @cnt = COUNT(*)
  FROM dbo.users
  WHERE nome = @identifier;

  IF @cnt = 0
    THROW 50011, 'usuário não encontrado', 1;

  IF @cnt > 1
    THROW 50012, 'nome ambíguo (use o login)', 1;

  SELECT TOP 1 id, nome, login, senha
  FROM dbo.users
  WHERE nome = @identifier;
END
GO

/* =========================================================
   PROCEDURE: criar sessão para user_id (retorna session_id)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_sessions_create
  @user_id INT,
  @ttl_minutes INT = 10080  -- 7 dias
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 50013, 'user_id inválido', 1;

  DECLARE @session_id UNIQUEIDENTIFIER = NEWID();
  DECLARE @expires_at DATETIME2 = DATEADD(MINUTE, @ttl_minutes, SYSDATETIME());

  INSERT INTO dbo.sessions (session_id, user_id, expires_at)
  VALUES (@session_id, @user_id, @expires_at);

  SELECT @session_id AS session_id, @expires_at AS expires_at;
END
GO

/* =========================================================
   PROCEDURE: obter sessão válida
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_sessions_get_valid
  @session_id UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  SELECT session_id, user_id, expires_at
  FROM dbo.sessions
  WHERE session_id = @session_id
    AND revoked_at IS NULL
    AND expires_at > SYSDATETIME();
END
GO

/* =========================================================
   PROCEDURE: revogar sessão (logout)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_sessions_revoke
  @session_id UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.sessions
  SET revoked_at = SYSDATETIME()
  WHERE session_id = @session_id
    AND revoked_at IS NULL;
END
GO






/* =========================================================
   GABINETES: tabelas/índices (se faltar) + procedures CRUD
   ========================================================= */

USE appdb;
GO

/* --- SET options necessários p/ índices filtrados e objetos --- */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* -------------------------------------------------------------
   Tabelas necessárias (caso ainda não existam)
-------------------------------------------------------------- */

-- acesso (lookup/enum)
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

-- seed acesso
IF NOT EXISTS (SELECT 1 FROM dbo.acesso WHERE nome = 'viewer')
  INSERT INTO dbo.acesso (nome) VALUES ('viewer');
IF NOT EXISTS (SELECT 1 FROM dbo.acesso WHERE nome = 'editor')
  INSERT INTO dbo.acesso (nome) VALUES ('editor');
IF NOT EXISTS (SELECT 1 FROM dbo.acesso WHERE nome = 'admin')
  INSERT INTO dbo.acesso (nome) VALUES ('admin');
GO

-- gabinete (FK -> users)
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

-- solicitacao (FKs -> users, gabinete, acesso)
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

/* =========================================================
   PROCEDURE: criar gabinete + criar solicitação admin atendido=1
   - @user_id = usuário logado
   - cria gabinete com user_id
   - cria solicitacao vinculando user/gabinete com acesso admin e atendido=1
   - retorna gabinete + solicitacao
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_gabinete_create
  @user_id INT,
  @nome NVARCHAR(150),
  @descricao NVARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 51001, 'user_id inválido', 1;

  IF @nome IS NULL OR LTRIM(RTRIM(@nome)) = N''
    THROW 51002, 'nome do gabinete é obrigatório', 1;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @user_id)
    THROW 51003, 'usuário não existe', 1;

  DECLARE @acesso_admin_id INT;
  SELECT @acesso_admin_id = id FROM dbo.acesso WHERE nome = 'admin';

  IF @acesso_admin_id IS NULL
    THROW 51004, 'acesso admin não encontrado (seed da tabela acesso)', 1;

  BEGIN TRAN;

  DECLARE @gabinete_id INT;

  INSERT INTO dbo.gabinete (nome, descricao, user_id)
  VALUES (@nome, @descricao, @user_id);

  SET @gabinete_id = CONVERT(INT, SCOPE_IDENTITY());

  DECLARE @solicitacao_id INT;

  INSERT INTO dbo.solicitacao (user_id, gabinete_id, atendido, acesso_id)
  VALUES (@user_id, @gabinete_id, 1, @acesso_admin_id);

  SET @solicitacao_id = CONVERT(INT, SCOPE_IDENTITY());

  COMMIT TRAN;

  SELECT
    g.id AS id,
    g.nome,
    g.descricao,
    g.user_id,
    @solicitacao_id AS solicitacao_id,
    @acesso_admin_id AS acesso_id
  FROM dbo.gabinete g
  WHERE g.id = @gabinete_id;
END
GO

/* =========================================================
   PROCEDURE: listar gabinetes do usuário logado
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_gabinete_list_by_user
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 51005, 'user_id inválido', 1;

  SELECT
    g.id,
    g.nome,
    g.descricao,
    g.user_id
  FROM dbo.gabinete g
  WHERE g.user_id = @user_id
  ORDER BY g.id DESC;
END
GO

/* =========================================================
   PROCEDURE: obter gabinete por id (somente do usuário logado)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_gabinete_get_by_id
  @user_id INT,
  @gabinete_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 51006, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 51007, 'gabinete_id inválido', 1;

  SELECT
    g.id,
    g.nome,
    g.descricao,
    g.user_id
  FROM dbo.gabinete g
  WHERE g.id = @gabinete_id
    AND g.user_id = @user_id;
END
GO

/* =========================================================
   PROCEDURE: atualizar gabinete (somente do usuário logado)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_gabinete_update
  @user_id INT,
  @gabinete_id INT,
  @nome NVARCHAR(150),
  @descricao NVARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 51008, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 51009, 'gabinete_id inválido', 1;

  IF @nome IS NULL OR LTRIM(RTRIM(@nome)) = N''
    THROW 51010, 'nome do gabinete é obrigatório', 1;

  UPDATE dbo.gabinete
  SET nome = @nome,
      descricao = @descricao
  WHERE id = @gabinete_id
    AND user_id = @user_id;

  IF @@ROWCOUNT = 0
    THROW 51011, 'gabinete não encontrado ou sem permissão', 1;

  SELECT id, nome, descricao, user_id
  FROM dbo.gabinete
  WHERE id = @gabinete_id;
END
GO

/* =========================================================
   PROCEDURE: deletar gabinete (somente do usuário logado)
   - remove solicitações vinculadas antes
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_gabinete_delete
  @user_id INT,
  @gabinete_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 51012, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 51013, 'gabinete_id inválido', 1;

  IF NOT EXISTS (
    SELECT 1 FROM dbo.gabinete
    WHERE id = @gabinete_id AND user_id = @user_id
  )
    THROW 51014, 'gabinete não encontrado ou sem permissão', 1;

  BEGIN TRAN;

  DELETE FROM dbo.solicitacao
  WHERE gabinete_id = @gabinete_id;

  DELETE FROM dbo.gabinete
  WHERE id = @gabinete_id
    AND user_id = @user_id;

  COMMIT TRAN;
END
GO




USE appdb;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* Se a coluna msg_pedido não existir (caso seu schema antigo esteja rodando) */
IF COL_LENGTH('dbo.solicitacao', 'msg_pedido') IS NULL
BEGIN
  ALTER TABLE dbo.solicitacao ADD msg_pedido NVARCHAR(500) NULL;
END
GO

/* =========================================================
   LISTAR SOLICITAÇÕES PENDENTES para gabinetes onde
   o usuário logado tem acesso ADMIN (atendido=1)
   Retorna: solicitacao + nome solicitante + nome gabinete + acesso
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_solicitacoes_list_for_admin
  @admin_user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @admin_user_id IS NULL OR @admin_user_id <= 0
    THROW 52001, 'admin_user_id inválido', 1;

  DECLARE @admin_acesso_id INT;
  SELECT @admin_acesso_id = id FROM dbo.acesso WHERE nome = 'admin';

  IF @admin_acesso_id IS NULL
    THROW 52002, 'acesso admin não encontrado (seed da tabela acesso)', 1;

  ;WITH AdminGabinetes AS (
    SELECT s.gabinete_id
    FROM dbo.solicitacao s
    WHERE s.user_id = @admin_user_id
      AND s.atendido = 1
      AND s.acesso_id = @admin_acesso_id
  )
  SELECT
    s.id,
    s.user_id,
    u.nome AS user_nome,
    s.gabinete_id,
    g.nome AS gabinete_nome,
    s.acesso_id,
    a.nome AS acesso_nome,
    s.atendido,
    s.msg_pedido,
    s.created_at
  FROM dbo.solicitacao s
  INNER JOIN AdminGabinetes ag ON ag.gabinete_id = s.gabinete_id
  INNER JOIN dbo.users u ON u.id = s.user_id
  INNER JOIN dbo.gabinete g ON g.id = s.gabinete_id
  INNER JOIN dbo.acesso a ON a.id = s.acesso_id
  WHERE s.atendido IS NULL -- pendentes
    AND NOT (s.user_id = @admin_user_id AND s.acesso_id = @admin_acesso_id AND s.atendido = 1)
  ORDER BY s.created_at DESC, s.id DESC;
END
GO

/* =========================================================
   APROVAR SOLICITAÇÃO
   - só admin do gabinete pode
   - só se estiver pendente (atendido IS NULL)
   - set atendido = 1 e msg_pedido = NULL
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_solicitacao_approve
  @admin_user_id INT,
  @solicitacao_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @admin_user_id IS NULL OR @admin_user_id <= 0
    THROW 52010, 'admin_user_id inválido', 1;

  IF @solicitacao_id IS NULL OR @solicitacao_id <= 0
    THROW 52011, 'solicitacao_id inválido', 1;

  DECLARE @admin_acesso_id INT;
  SELECT @admin_acesso_id = id FROM dbo.acesso WHERE nome = 'admin';
  IF @admin_acesso_id IS NULL
    THROW 52012, 'acesso admin não encontrado', 1;

  DECLARE @gabinete_id INT;
  SELECT @gabinete_id = gabinete_id
  FROM dbo.solicitacao
  WHERE id = @solicitacao_id;

  IF @gabinete_id IS NULL
    THROW 52013, 'solicitação não encontrada', 1;

  IF NOT EXISTS (
    SELECT 1
    FROM dbo.solicitacao sadmin
    WHERE sadmin.user_id = @admin_user_id
      AND sadmin.gabinete_id = @gabinete_id
      AND sadmin.atendido = 1
      AND sadmin.acesso_id = @admin_acesso_id
  )
    THROW 52014, 'sem permissão (você não é admin deste gabinete)', 1;

  IF NOT EXISTS (SELECT 1 FROM dbo.solicitacao WHERE id = @solicitacao_id AND atendido IS NULL)
    THROW 52015, 'solicitação já foi respondida', 1;

  BEGIN TRAN;

  UPDATE dbo.solicitacao
  SET atendido = 1,
      msg_pedido = NULL
  WHERE id = @solicitacao_id
    AND atendido IS NULL;

  COMMIT TRAN;

  SELECT
    s.id,
    s.user_id,
    u.nome AS user_nome,
    s.gabinete_id,
    g.nome AS gabinete_nome,
    s.acesso_id,
    a.nome AS acesso_nome,
    s.atendido,
    s.msg_pedido,
    s.created_at
  FROM dbo.solicitacao s
  JOIN dbo.users u ON u.id = s.user_id
  JOIN dbo.gabinete g ON g.id = s.gabinete_id
  JOIN dbo.acesso a ON a.id = s.acesso_id
  WHERE s.id = @solicitacao_id;
END
GO

/* =========================================================
   REJEITAR SOLICITAÇÃO
   - só admin do gabinete pode
   - só se estiver pendente
   - set atendido = 0 e msg_pedido = @msg_pedido (mensagem de rejeição)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_solicitacao_reject
  @admin_user_id INT,
  @solicitacao_id INT,
  @msg_pedido NVARCHAR(500) = NULL  -- mantido só por compatibilidade
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @admin_user_id IS NULL OR @admin_user_id <= 0
    THROW 52020, 'admin_user_id inválido', 1;

  IF @solicitacao_id IS NULL OR @solicitacao_id <= 0
    THROW 52021, 'solicitacao_id inválido', 1;

  DECLARE @admin_acesso_id INT;
  SELECT @admin_acesso_id = id FROM dbo.acesso WHERE nome = 'admin';
  IF @admin_acesso_id IS NULL
    THROW 52023, 'acesso admin não encontrado', 1;

  DECLARE @gabinete_id INT;
  SELECT @gabinete_id = gabinete_id
  FROM dbo.solicitacao
  WHERE id = @solicitacao_id;

  IF @gabinete_id IS NULL
    THROW 52024, 'solicitação não encontrada', 1;

  IF NOT EXISTS (
    SELECT 1
    FROM dbo.solicitacao sadmin
    WHERE sadmin.user_id = @admin_user_id
      AND sadmin.gabinete_id = @gabinete_id
      AND sadmin.atendido = 1
      AND sadmin.acesso_id = @admin_acesso_id
  )
    THROW 52025, 'sem permissão (você não é admin deste gabinete)', 1;

  IF NOT EXISTS (SELECT 1 FROM dbo.solicitacao WHERE id = @solicitacao_id AND atendido IS NULL)
    THROW 52026, 'solicitação já foi respondida', 1;

  BEGIN TRAN;

  UPDATE dbo.solicitacao
  SET atendido = 0
  WHERE id = @solicitacao_id
    AND atendido IS NULL;

  COMMIT TRAN;

  SELECT
    s.id,
    s.user_id,
    u.nome AS user_nome,
    s.gabinete_id,
    g.nome AS gabinete_nome,
    s.acesso_id,
    a.nome AS acesso_nome,
    s.atendido,
    s.msg_pedido,
    s.created_at
  FROM dbo.solicitacao s
  JOIN dbo.users u ON u.id = s.user_id
  JOIN dbo.gabinete g ON g.id = s.gabinete_id
  JOIN dbo.acesso a ON a.id = s.acesso_id
  WHERE s.id = @solicitacao_id;
END
GO


USE appdb;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* =========================================================
   LISTAR TODOS OS GABINETES + status do usuário logado
   - retorna gabinete + dono + (minha solicitação, se existir)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_gabinetes_list_all_for_user
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53001, 'user_id inválido', 1;

  SELECT
    g.id,
    g.nome,
    g.descricao,
    g.user_id AS owner_id,
    u.nome AS owner_nome,

    ms.id AS minha_solicitacao_id,
    ms.atendido AS minha_atendido,
    ma.nome AS meu_acesso_nome,
    ms.msg_pedido AS minha_msg_pedido,
    ms.created_at AS minha_created_at
  FROM dbo.gabinete g
  INNER JOIN dbo.users u ON u.id = g.user_id
  LEFT JOIN dbo.solicitacao ms
    ON ms.gabinete_id = g.id AND ms.user_id = @user_id
  LEFT JOIN dbo.acesso ma
    ON ma.id = ms.acesso_id
  ORDER BY g.id DESC;
END
GO

/* =========================================================
   SOLICITAR (OU RE-SOLICITAR) ACESSO A UM GABINETE
   - cria solicitação (atendido = NULL) e grava msg_pedido
   - se já existir solicitação:
       - se atendido = 1 -> bloqueia (já tem acesso)
       - se atendido = 0 ou NULL -> atualiza e volta para pendente
   - impede solicitar acesso ao próprio gabinete
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_solicitacao_request_access
  @user_id INT,
  @gabinete_id INT,
  @acesso_nome NVARCHAR(20),
  @msg_pedido NVARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53010, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 53011, 'gabinete_id inválido', 1;

  IF @acesso_nome IS NULL OR LTRIM(RTRIM(@acesso_nome)) = N''
    THROW 53012, 'acesso_nome é obrigatório', 1;

  IF NOT EXISTS (SELECT 1 FROM dbo.gabinete WHERE id = @gabinete_id)
    THROW 53013, 'gabinete não existe', 1;

  IF EXISTS (SELECT 1 FROM dbo.gabinete WHERE id = @gabinete_id AND user_id = @user_id)
    THROW 53014, 'você não pode solicitar acesso ao seu próprio gabinete', 1;

  DECLARE @acesso_id INT;
  SELECT @acesso_id = id FROM dbo.acesso WHERE nome = LTRIM(RTRIM(@acesso_nome));

  IF @acesso_id IS NULL
    THROW 53015, 'tipo de acesso inválido', 1;

  DECLARE @exists INT = 0;
  SELECT @exists = COUNT(*) FROM dbo.solicitacao WHERE user_id = @user_id AND gabinete_id = @gabinete_id;

  BEGIN TRAN;

  IF @exists = 1
  BEGIN
    DECLARE @atendido INT = NULL;
    SELECT @atendido = atendido FROM dbo.solicitacao WHERE user_id = @user_id AND gabinete_id = @gabinete_id;

    IF @atendido = 1
    BEGIN
      ROLLBACK TRAN;
      THROW 53016, 'você já possui acesso a este gabinete', 1;
    END

    UPDATE dbo.solicitacao
    SET acesso_id = @acesso_id,
        msg_pedido = NULLIF(LEFT(LTRIM(RTRIM(ISNULL(@msg_pedido, N''))), 500), N''),
        atendido = NULL,
        created_at = SYSDATETIME()
    WHERE user_id = @user_id AND gabinete_id = @gabinete_id;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.solicitacao (user_id, gabinete_id, atendido, acesso_id, msg_pedido)
    VALUES (
      @user_id,
      @gabinete_id,
      NULL,
      @acesso_id,
      NULLIF(LEFT(LTRIM(RTRIM(ISNULL(@msg_pedido, N''))), 500), N'')
    );
  END

  COMMIT TRAN;

  SELECT
    s.id,
    s.user_id,
    u.nome AS user_nome,
    s.gabinete_id,
    g.nome AS gabinete_nome,
    s.acesso_id,
    a.nome AS acesso_nome,
    s.atendido,
    s.msg_pedido,
    s.created_at
  FROM dbo.solicitacao s
  INNER JOIN dbo.users u ON u.id = s.user_id
  INNER JOIN dbo.gabinete g ON g.id = s.gabinete_id
  INNER JOIN dbo.acesso a ON a.id = s.acesso_id
  WHERE s.user_id = @user_id AND s.gabinete_id = @gabinete_id;
END
GO

USE appdb;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   LISTAR STATUS DE ARQUIVO
========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_status_arquivo_list
AS
BEGIN
  SET NOCOUNT ON;

  SELECT id, nome
  FROM dbo.status_arquivo
  ORDER BY id ASC;
END
GO

/* =========================================================
   LISTAR GABINETES ACESSÍVEIS PELO USUÁRIO (atendido=1)
   - retorna gabinetes onde o user tem solicitação atendida
========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_gabinetes_accessible_list
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53001, 'user_id inválido', 1;

  SELECT DISTINCT
    g.id,
    g.nome,
    g.descricao,
    g.user_id
  FROM dbo.gabinete g
  JOIN dbo.solicitacao s
    ON s.gabinete_id = g.id
   AND s.user_id = @user_id
   AND s.atendido = 1
  ORDER BY g.nome ASC;
END
GO

/* =========================================================
   LISTAR ARQUIVOS (PROCESSOS) DO USUÁRIO (por gabinetes acessíveis)
========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_arquivo_list_for_user
  @user_id INT,
  @q NVARCHAR(200) = NULL,
  @status_arquivo_id INT = NULL,
  @gabinete_id INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53010, 'user_id inválido', 1;

  DECLARE @qq NVARCHAR(200) = LTRIM(RTRIM(ISNULL(@q, N'')));

  SELECT
    arq.id,
    arq.nome_processo,
    arq.descricao,
    arq.status_arquivo_id,
    sa.nome AS status_nome,
    arq.gabinete_id,
    g.nome AS gabinete_nome,
    arq.created_at
  FROM dbo.arquivo arq
  JOIN dbo.status_arquivo sa ON sa.id = arq.status_arquivo_id
  JOIN dbo.gabinete g ON g.id = arq.gabinete_id
  WHERE EXISTS (
    SELECT 1
    FROM dbo.solicitacao s
    WHERE s.user_id = @user_id
      AND s.gabinete_id = arq.gabinete_id
      AND s.atendido = 1
  )
  AND (@status_arquivo_id IS NULL OR arq.status_arquivo_id = @status_arquivo_id)
  AND (@gabinete_id IS NULL OR arq.gabinete_id = @gabinete_id)
  AND (
    @qq = N''
    OR arq.nome_processo LIKE N'%' + @qq + N'%'
    OR ISNULL(arq.descricao, N'') LIKE N'%' + @qq + N'%'
    OR g.nome LIKE N'%' + @qq + N'%'
    OR sa.nome LIKE N'%' + @qq + N'%'
  )
  ORDER BY arq.id DESC;
END
GO

/* =========================================================
   CRIAR ARQUIVO (upload do PDF no banco)
   - exige que o usuário tenha acesso atendido ao gabinete
========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_arquivo_create
  @user_id INT,
  @gabinete_id INT,
  @status_arquivo_id INT,
  @nome_processo NVARCHAR(255),
  @descricao NVARCHAR(1000) = NULL,
  @pdf VARBINARY(MAX) = NULL,
  @txt NVARCHAR(MAX) = NULL,
  @metadados_json NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @nome_processo IS NULL OR LTRIM(RTRIM(@nome_processo)) = N''
    THROW 52001, 'nome_processo é obrigatório', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 52002, 'gabinete_id inválido', 1;

  IF @status_arquivo_id IS NULL OR @status_arquivo_id <= 0
    THROW 52003, 'status_arquivo_id inválido', 1;

  BEGIN TRAN;

  INSERT INTO dbo.arquivo (pdf, txt, nome_processo, descricao, status_arquivo_id, gabinete_id)
  VALUES (@pdf, @txt, @nome_processo, @descricao, @status_arquivo_id, @gabinete_id);

  DECLARE @arquivo_id INT = SCOPE_IDENTITY();

  -- ✅ Insere/atualiza metadados (se vierem)
  IF @metadados_json IS NOT NULL AND ISJSON(@metadados_json) = 1
  BEGIN
    ;WITH j AS (
      SELECT
        LTRIM(RTRIM(nome)) AS nome,
        valor
      FROM OPENJSON(@metadados_json)
      WITH (
        nome  NVARCHAR(200) '$.nome',
        valor NVARCHAR(MAX) '$.valor'
      )
      WHERE nome IS NOT NULL AND LTRIM(RTRIM(nome)) <> N''
    )
    MERGE dbo.metadado AS tgt
    USING j AS src
      ON tgt.arquivo_id = @arquivo_id AND tgt.nome = src.nome
    WHEN MATCHED THEN
      UPDATE SET valor = src.valor
    WHEN NOT MATCHED THEN
      INSERT (nome, valor, arquivo_id)
      VALUES (src.nome, src.valor, @arquivo_id);
  END

  COMMIT TRAN;

  SELECT
    a.id,
    a.nome_processo,
    a.descricao,
    a.status_arquivo_id,
    a.gabinete_id,
    a.created_at
  FROM dbo.arquivo a
  WHERE a.id = @arquivo_id;
END
GO

/* =========================================================
   BAIXAR/ABRIR PDF (apenas se o usuário tiver acesso ao gabinete)
========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_arquivo_get_pdf_for_user
  @user_id INT,
  @arquivo_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53030, 'user_id inválido', 1;

  IF @arquivo_id IS NULL OR @arquivo_id <= 0
    THROW 53031, 'arquivo_id inválido', 1;

  DECLARE @gabinete_id INT;

  SELECT @gabinete_id = gabinete_id
  FROM dbo.arquivo
  WHERE id = @arquivo_id;

  IF @gabinete_id IS NULL
    THROW 53032, 'arquivo não encontrado', 1;

  IF NOT EXISTS (
    SELECT 1
    FROM dbo.solicitacao s
    WHERE s.user_id = @user_id
      AND s.gabinete_id = @gabinete_id
      AND s.atendido = 1
  )
    THROW 53033, 'sem acesso ao gabinete', 1;

  SELECT
    pdf,
    nome_processo
  FROM dbo.arquivo
  WHERE id = @arquivo_id;
END
GO

USE appdb;
GO

/* =========================================================
   LISTAR METADADOS DO ARQUIVO (somente se user tem acesso)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_metadado_list_for_user
  @user_id INT,
  @arquivo_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 52101, 'user_id inválido', 1;

  IF @arquivo_id IS NULL OR @arquivo_id <= 0
    THROW 52102, 'arquivo_id inválido', 1;

  -- Permissão: user precisa ter solicitação atendida para o gabinete do arquivo
  IF NOT EXISTS (
    SELECT 1
    FROM dbo.arquivo a
    WHERE a.id = @arquivo_id
      AND EXISTS (
        SELECT 1
        FROM dbo.solicitacao s
        WHERE s.user_id = @user_id
          AND s.gabinete_id = a.gabinete_id
          AND s.atendido = 1
      )
  )
    THROW 52103, 'sem permissão para acessar este arquivo', 1;

  SELECT
    m.id,
    m.nome,
    m.valor
  FROM dbo.metadado m
  WHERE m.arquivo_id = @arquivo_id
  ORDER BY m.nome ASC, m.id ASC;
END
GO

/* =========================================================
   LISTAR EVENTOS DO ARQUIVO (somente se user tem acesso)
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_evento_list_for_user
  @user_id INT,
  @arquivo_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 52111, 'user_id inválido', 1;

  IF @arquivo_id IS NULL OR @arquivo_id <= 0
    THROW 52112, 'arquivo_id inválido', 1;

  IF NOT EXISTS (
    SELECT 1
    FROM dbo.arquivo a
    WHERE a.id = @arquivo_id
      AND EXISTS (
        SELECT 1
        FROM dbo.solicitacao s
        WHERE s.user_id = @user_id
          AND s.gabinete_id = a.gabinete_id
          AND s.atendido = 1
      )
  )
    THROW 52113, 'sem permissão para acessar este arquivo', 1;

  SELECT
    e.id,
    e.nome,
    e.created_at,
    e.arquivo_id,
    e.status_evento_id,
    se.nome AS status_nome,
    e.procurador_id,
    p.nome AS procurador_nome
  FROM dbo.evento e
  LEFT JOIN dbo.status_evento se ON se.id = e.status_evento_id
  LEFT JOIN dbo.procurador p ON p.id = e.procurador_id
  WHERE e.arquivo_id = @arquivo_id
  ORDER BY e.created_at DESC, e.id DESC;
END
GO

USE appdb;
GO

CREATE OR ALTER PROCEDURE dbo.usp_eventos_list_by_arquivo
  @arquivo_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @arquivo_id IS NULL OR @arquivo_id <= 0
    THROW 52002, 'arquivo_id inválido', 1;

  -- (Opcional, mas recomendado) garante que o arquivo existe
  IF NOT EXISTS (
    SELECT 1
    FROM dbo.arquivo a
    WHERE a.id = @arquivo_id
  )
    THROW 52004, 'Arquivo não encontrado.', 1;

  SELECT
    e.id,
    e.nome,
    e.created_at,
    e.arquivo_id,
    e.status_evento_id,
    se.nome AS status_nome,
    e.procurador_id,
    pr.nome AS procurador_nome,
    pe.pages_json AS evento_pages_json
  FROM dbo.evento e
  LEFT JOIN dbo.status_evento se ON se.id = e.status_evento_id
  LEFT JOIN dbo.procurador pr ON pr.id = e.procurador_id
  LEFT JOIN dbo.pages pe ON pe.evento_id = e.id
  WHERE e.arquivo_id = @arquivo_id
  ORDER BY e.id DESC;
END
GO

USE appdb;
GO

CREATE OR ALTER PROCEDURE dbo.usp_event_pages_update
  @user_id INT,
  @evento_id INT,
  @pages_json NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 52001, 'user_id inválido', 1;

  IF @evento_id IS NULL OR @evento_id <= 0
    THROW 52002, 'evento_id inválido', 1;

  IF @pages_json IS NULL OR ISJSON(@pages_json) <> 1
    THROW 52003, 'pages_json inválido (precisa ser JSON array)', 1;

  -- Permissão: precisa ser ADMIN no gabinete do arquivo do evento
  IF NOT EXISTS (
    SELECT 1
    FROM dbo.evento e
    JOIN dbo.arquivo a       ON a.id = e.arquivo_id
    JOIN dbo.solicitacao s  ON s.gabinete_id = a.gabinete_id
                           AND s.user_id = @user_id
                           AND s.atendido = 1
    JOIN dbo.acesso ac      ON ac.id = s.acesso_id
                           AND ac.nome = 'admin'
    WHERE e.id = @evento_id
  )
    THROW 52004, 'Sem permissão para editar páginas deste evento.', 1;

  BEGIN TRAN;

  -- garante row em dbo.pages (1-1 por evento)
  IF NOT EXISTS (SELECT 1 FROM dbo.pages WHERE evento_id = @evento_id)
  BEGIN
    INSERT INTO dbo.pages (evento_id, pages_json)
    VALUES (@evento_id, N'[]');
  END

  DECLARE @new_json NVARCHAR(MAX);

  ;WITH v AS (
    SELECT DISTINCT TRY_CAST([value] AS INT) AS p
    FROM OPENJSON(@pages_json)
    WHERE TRY_CAST([value] AS INT) IS NOT NULL
      AND TRY_CAST([value] AS INT) > 0
  )
  SELECT @new_json =
    CASE
      WHEN COUNT(*) = 0 THEN N'[]'
      ELSE N'[' + STRING_AGG(CAST(p AS NVARCHAR(20)), N',') WITHIN GROUP (ORDER BY p) + N']'
    END
  FROM v;

  UPDATE dbo.pages
  SET pages_json = @new_json
  WHERE evento_id = @evento_id;

  COMMIT TRAN;

  SELECT @evento_id AS evento_id, @new_json AS pages_json;
END
GO

USE appdb;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   LISTAR: todos os acessos do usuário (aprovados)
   - fonte: dbo.solicitacao
   - atendido = 1
   - retorna is_owner para desabilitar ações no front
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_meus_acessos_list
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53001, 'user_id inválido', 1;

  SELECT
    s.id               AS solicitacao_id,
    s.gabinete_id      AS gabinete_id,
    g.nome             AS gabinete_nome,
    s.acesso_id        AS acesso_id,
    a.nome             AS acesso_nome,
    s.created_at       AS created_at,
    CASE WHEN g.user_id = @user_id THEN 1 ELSE 0 END AS is_owner
  FROM dbo.solicitacao s
  INNER JOIN dbo.gabinete g ON g.id = s.gabinete_id
  INNER JOIN dbo.acesso  a ON a.id = s.acesso_id
  WHERE s.user_id = @user_id
    AND s.atendido = 1
  ORDER BY s.created_at DESC, s.id DESC;
END
GO

/* =========================================================
   EDITAR: alterar tipo de acesso do usuário em um gabinete
   - bloqueia se usuário for dono do gabinete
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_meus_acessos_update
  @user_id INT,
  @gabinete_id INT,
  @acesso_nome NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53002, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 53003, 'gabinete_id inválido', 1;

  IF @acesso_nome IS NULL OR LTRIM(RTRIM(@acesso_nome)) = N''
    THROW 53004, 'acesso_nome é obrigatório', 1;

  -- não deixa editar o dono do gabinete
  IF EXISTS (
    SELECT 1
    FROM dbo.gabinete g
    WHERE g.id = @gabinete_id AND g.user_id = @user_id
  )
    THROW 53005, 'Não é permitido editar o acesso do dono do gabinete.', 1;

  DECLARE @acesso_id INT;
  SELECT @acesso_id = id FROM dbo.acesso WHERE nome = @acesso_nome;

  IF @acesso_id IS NULL
    THROW 53006, 'acesso_nome inválido (viewer/editor/admin)', 1;

  UPDATE dbo.solicitacao
  SET acesso_id = @acesso_id
  WHERE user_id = @user_id
    AND gabinete_id = @gabinete_id
    AND atendido = 1;

  IF @@ROWCOUNT = 0
    THROW 53007, 'Acesso não encontrado (ou não aprovado).', 1;

  SELECT
    s.id               AS solicitacao_id,
    s.gabinete_id      AS gabinete_id,
    g.nome             AS gabinete_nome,
    s.acesso_id        AS acesso_id,
    a.nome             AS acesso_nome,
    s.created_at       AS created_at,
    CASE WHEN g.user_id = @user_id THEN 1 ELSE 0 END AS is_owner
  FROM dbo.solicitacao s
  INNER JOIN dbo.gabinete g ON g.id = s.gabinete_id
  INNER JOIN dbo.acesso  a ON a.id = s.acesso_id
  WHERE s.user_id = @user_id
    AND s.gabinete_id = @gabinete_id;
END
GO

/* =========================================================
   REMOVER: remover acesso do usuário a um gabinete
   - bloqueia se usuário for dono do gabinete
   ========================================================= */
CREATE OR ALTER PROCEDURE dbo.usp_meus_acessos_delete
  @user_id INT,
  @gabinete_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 53008, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 53009, 'gabinete_id inválido', 1;

  -- não deixa remover o dono do gabinete
  IF EXISTS (
    SELECT 1
    FROM dbo.gabinete g
    WHERE g.id = @gabinete_id AND g.user_id = @user_id
  )
    THROW 53010, 'Não é permitido remover o acesso do dono do gabinete.', 1;

  DELETE FROM dbo.solicitacao
  WHERE user_id = @user_id
    AND gabinete_id = @gabinete_id
    AND atendido = 1;

  IF @@ROWCOUNT = 0
    THROW 53011, 'Acesso não encontrado (ou não aprovado).', 1;
END
GO


CREATE OR ALTER PROCEDURE dbo.usp_gabinetes_list_for_user
  @user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 52001, 'user_id inválido', 1;

  SELECT
    g.id,
    g.nome,
    g.descricao,
    g.user_id,
    a.nome AS meu_acesso_nome
  FROM dbo.gabinete g
  JOIN dbo.solicitacao s
    ON s.gabinete_id = g.id
   AND s.user_id = @user_id
   AND s.atendido = 1
  JOIN dbo.acesso a
    ON a.id = s.acesso_id
  ORDER BY g.id DESC;
END
GO


CREATE OR ALTER PROCEDURE dbo.usp_gabinete_get_for_user
  @user_id INT,
  @gabinete_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 52001, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 52002, 'gabinete_id inválido', 1;

  IF NOT EXISTS (
    SELECT 1
    FROM dbo.solicitacao s
    WHERE s.gabinete_id = @gabinete_id
      AND s.user_id = @user_id
      AND s.atendido = 1
  )
    THROW 52003, 'Sem permissão para acessar este gabinete.', 1;

  SELECT TOP 1
    g.id,
    g.nome,
    g.descricao,
    g.user_id,
    a.nome AS meu_acesso_nome
  FROM dbo.gabinete g
  JOIN dbo.solicitacao s
    ON s.gabinete_id = g.id
   AND s.user_id = @user_id
   AND s.atendido = 1
  JOIN dbo.acesso a
    ON a.id = s.acesso_id
  WHERE g.id = @gabinete_id;
END
GO


CREATE OR ALTER PROCEDURE dbo.usp_gabinete_users_list
  @user_id INT,
  @gabinete_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @user_id IS NULL OR @user_id <= 0
    THROW 52001, 'user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 52002, 'gabinete_id inválido', 1;

  IF NOT EXISTS (
    SELECT 1
    FROM dbo.solicitacao s
    WHERE s.gabinete_id = @gabinete_id
      AND s.user_id = @user_id
      AND s.atendido = 1
  )
    THROW 52003, 'Sem permissão para ver usuários deste gabinete.', 1;

  DECLARE @owner_id INT;
  SELECT @owner_id = g.user_id
  FROM dbo.gabinete g
  WHERE g.id = @gabinete_id;

  SELECT
    u.id AS user_id,
    u.nome AS user_nome,
    a.nome AS acesso_nome,
    CASE WHEN u.id = @owner_id THEN 1 ELSE 0 END AS is_owner
  FROM dbo.solicitacao s
  JOIN dbo.[users] u
    ON u.id = s.user_id
  JOIN dbo.acesso a
    ON a.id = s.acesso_id
  WHERE s.gabinete_id = @gabinete_id
    AND s.atendido = 1
  ORDER BY
    CASE WHEN u.id = @owner_id THEN 0 ELSE 1 END,
    u.nome ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_gabinete_user_remove_access
  @actor_user_id INT,
  @gabinete_id INT,
  @target_user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF @actor_user_id IS NULL OR @actor_user_id <= 0
    THROW 52001, 'actor_user_id inválido', 1;

  IF @gabinete_id IS NULL OR @gabinete_id <= 0
    THROW 52002, 'gabinete_id inválido', 1;

  IF @target_user_id IS NULL OR @target_user_id <= 0
    THROW 52003, 'target_user_id inválido', 1;

  DECLARE @owner_id INT;
  SELECT @owner_id = g.user_id
  FROM dbo.gabinete g
  WHERE g.id = @gabinete_id;

  IF @owner_id IS NULL
    THROW 52004, 'Gabinete inexistente.', 1;

  IF @target_user_id = @owner_id
    THROW 52005, 'Não é permitido remover o dono do gabinete.', 1;

  -- actor precisa ser admin
  IF NOT EXISTS (
    SELECT 1
    FROM dbo.solicitacao s
    JOIN dbo.acesso a ON a.id = s.acesso_id
    WHERE s.gabinete_id = @gabinete_id
      AND s.user_id = @actor_user_id
      AND s.atendido = 1
      AND LOWER(a.nome) = 'admin'
  )
    THROW 52006, 'Apenas admin pode remover permissões.', 1;

  -- remove acesso do target (remove solicitação atendida)
  DELETE FROM dbo.solicitacao
  WHERE gabinete_id = @gabinete_id
    AND user_id = @target_user_id
    AND atendido = 1;

  SELECT 1 AS ok;
END
GO
