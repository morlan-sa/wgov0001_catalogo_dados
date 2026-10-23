"""Cache assíncrono em memória com TTL para as leituras do catálogo.

Cada consulta ao banco custa uma ida e volta de rede, e a saúde dos dados varre
tabelas inteiras — mas os metadados mudam raramente. O cache guarda o resultado
por `ttl` segundos e faz chamadas simultâneas iguais (o Dashboard dispara
várias de uma vez) compartilharem uma única execução. Falhas nunca são
guardadas. É por processo: cada réplica tem o seu, e o TTL limita o quanto um
dado pode ficar velho.
"""

import asyncio
import copy
import functools
import time
from collections.abc import Awaitable, Callable, Hashable
from typing import Any, ParamSpec, TypeVar

from app.config import settings

P = ParamSpec("P")
R = TypeVar("R")

_entradas: dict[tuple[Any, ...], tuple[float, "asyncio.Future[Any]"]] = {}


def limpar() -> None:
    _entradas.clear()


def ttl_cache(
    ttl_setting: str, key: Callable[..., Hashable] | None = None
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """Decorator; `ttl_setting` é o NOME do campo de `Settings` com o TTL em
    segundos (lido a cada chamada, não no import). Os argumentos precisam ser
    hashables; senão passe `key(*args, **kwargs)` devolvendo uma chave que
    represente os argumentos (ex.: listas viram tuplas)."""

    def decorator(fn: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        @functools.wraps(fn)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            ttl = float(getattr(settings, ttl_setting))
            if ttl <= 0:
                return await fn(*args, **kwargs)

            argumentos = (
                key(*args, **kwargs) if key else (args, tuple(sorted(kwargs.items())))
            )
            chave = (fn.__module__, fn.__qualname__, argumentos)
            agora = time.monotonic()
            existente = _entradas.get(chave)
            if existente and existente[0] > agora:
                futuro = existente[1]
            else:
                futuro = asyncio.ensure_future(fn(*args, **kwargs))
                _entradas[chave] = (agora + ttl, futuro)
                futuro.add_done_callback(_esquecer_se_falhou(chave, futuro))
            # `shield`: quem desiste (cliente desconectou) não cancela a
            # execução que outros estão esperando.
            resultado = await asyncio.shield(futuro)
            # Quem chama pode mutar o resultado (ex.: anexar completude às
            # colunas) — cada um recebe a sua cópia.
            return copy.deepcopy(resultado)

        return wrapper

    return decorator


def _esquecer_se_falhou(
    chave: tuple[Any, ...], futuro: "asyncio.Future[Any]"
) -> Callable[[Any], None]:
    def callback(_: Any) -> None:
        if futuro.cancelled() or futuro.exception() is not None:
            if _entradas.get(chave, (0, None))[1] is futuro:
                _entradas.pop(chave, None)

    return callback
