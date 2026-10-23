"""`app/db/db2.py` — só leitura, e a nova tentativa em SQL5005C. Nenhum teste
abre conexão DB2 de verdade."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import ibm_db_dbi
import pytest

from app.db import db2


class TestSomenteLeitura:
    @pytest.mark.parametrize(
        "sql",
        [
            "DELETE FROM SYSCAT.TABLES WHERE 1=0",
            "INSERT INTO SYSCAT.TABLES VALUES (...)",
            "UPDATE SYSCAT.TABLES SET X = 1",
            "DROP TABLE X",
        ],
    )
    async def test_rejeita_comando_que_nao_e_consulta_sem_abrir_conexao(self, sql):
        with patch.object(db2, "_connect") as connect:
            with pytest.raises(
                db2.Db2ReadOnlyError, match="Somente consultas SELECT são permitidas"
            ) as exc:
                await db2.query(sql)
        assert sql.split()[0] in str(exc.value)
        connect.assert_not_called()

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT 1 FROM SYSIBM.SYSDUMMY1",
            "  select 1 from sysibm.sysdummy1",
            "WITH t AS (SELECT 1 AS n FROM SYSIBM.SYSDUMMY1) SELECT * FROM t",
        ],
    )
    async def test_aceita_select_e_with(self, sql):
        with patch.object(db2, "_run", return_value=[{"N": 1}]) as run:
            assert await db2.query(sql) == [{"N": 1}]
        run.assert_called_once()


class TestExecucao:
    def test_devolve_linhas_como_dict_pelo_nome_da_coluna(self):
        cursor = MagicMock()
        cursor.description = [("UM",), ("DOIS",)]
        cursor.fetchall.return_value = [(1, "a"), (2, "b")]
        conn = MagicMock()
        conn.cursor.return_value = cursor
        with patch.object(db2, "_connect", return_value=conn):
            rows = db2._run("SELECT UM, DOIS FROM T WHERE X = ?", ["x"])
        assert rows == [{"UM": 1, "DOIS": "a"}, {"UM": 2, "DOIS": "b"}]
        cursor.execute.assert_called_once_with(
            "SELECT UM, DOIS FROM T WHERE X = ?", ("x",)
        )
        cursor.close.assert_called_once()
        conn.close.assert_called_once()

    def test_fecha_a_conexao_mesmo_quando_a_consulta_falha(self):
        cursor = MagicMock()
        cursor.execute.side_effect = RuntimeError("boom")
        conn = MagicMock()
        conn.cursor.return_value = cursor
        with patch.object(db2, "_connect", return_value=conn):
            with pytest.raises(RuntimeError):
                db2._run("SELECT 1 FROM T", [])
        conn.close.assert_called_once()


class TestConexao:
    def test_repete_uma_vez_em_sql5005c(self):
        conn = MagicMock()
        erro = ibm_db_dbi.Error("SQL5005C falha ao acessar o arquivo de configuração")
        with (
            patch.object(ibm_db_dbi, "connect", side_effect=[erro, conn]) as connect,
            patch.object(db2.time, "sleep") as sleep,
        ):
            assert db2._connect() is conn
        assert connect.call_count == 2
        sleep.assert_called_once()

    def test_nao_repete_outros_erros(self):
        erro = ibm_db_dbi.Error("SQL30082N credenciais inválidas")
        with patch.object(ibm_db_dbi, "connect", side_effect=erro) as connect:
            with pytest.raises(ibm_db_dbi.Error):
                db2._connect()
        assert connect.call_count == 1

    def test_dsn_vem_das_configuracoes(self):
        dsn = db2._dsn()
        assert "DATABASE=testdb;" in dsn
        assert "HOSTNAME=db2.test;" in dsn
        assert "PORT=50000;" in dsn
