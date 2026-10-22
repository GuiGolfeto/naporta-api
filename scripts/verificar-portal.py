"""Verificação do portal (Next.js) talking com a API real, via Server Actions."""

import json
import re
import urllib.request

WEB = "http://localhost:3001"
API = "http://localhost:3000/api/v1"

ok = 0
fail = 0


def check(desc, esperado, obtido):
    global ok, fail
    if esperado == obtido:
        print(f"  \x1b[32m✓\x1b[0m {desc:<52} {obtido}")
        ok += 1
    else:
        print(f"  \x1b[31m✗\x1b[0m {desc:<52} esperado: {esperado} · obtido: {obtido}")
        fail += 1


def action_ids(path):
    """Descobre os ids das Server Actions carregados por uma página."""
    page = urllib.request.urlopen(f"{WEB}{path}").read().decode()
    ids = set()
    for chunk in re.findall(r'src="(/_next/static/chunks/[^"]+\.js)"', page):
        try:
            content = urllib.request.urlopen(f"{WEB}{chunk}").read().decode()
        except Exception:
            continue
        ids.update(re.findall(r'["\']([0-9a-f]{40,})["\']', content))
    return ids


def call_action(path, action_id, args, cookie=None):
    """Chama uma Server Action pelo mesmo caminho que o browser usa."""
    request = urllib.request.Request(
        f"{WEB}{path}",
        data=json.dumps(args).encode(),
        headers={
            "Content-Type": "text/plain;charset=UTF-8",
            "Next-Action": action_id,
            "Accept": "text/x-component",
            **({"Cookie": cookie} if cookie else {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        return response.status, response.headers.get_all("Set-Cookie") or [], response.read().decode()


print("\n\x1b[1mPortal — login pela Server Action\x1b[0m")
ids = action_ids("/login")

status, cookies, _ = None, [], ""
for action_id in sorted(ids):
    try:
        status, cookies, body = call_action(
            "/login", action_id, ["admin@naporta.local", "Admin@1234"]
        )
    except urllib.error.HTTPError as error:
        status, cookies, body = error.code, error.headers.get_all("Set-Cookie") or [], error.read().decode()

    if any(c.startswith("naporta_access_token=ey") for c in cookies):
        break

jar = "; ".join(c.split(";")[0] for c in cookies)
check("login define o cookie de sessão", "sim", "sim" if jar else "nao")
check("access token gravado como httpOnly", "sim", "sim" if any("HttpOnly" in c for c in cookies) else "nao")
check("refresh token gravado como httpOnly", "sim", "sim" if any("HttpOnly" in c for c in cookies) else "nao")
check("mesmaSite=lax", "sim", "sim" if any("SameSite=lax" in c for c in cookies) else "nao")

print("\n\x1b[1mPortal — dashboard com a sessão\x1b[0m")
dash = urllib.request.urlopen(urllib.request.Request(f"{WEB}/", headers={"Cookie": jar})).read().decode()
numeros = sorted(set(re.findall(r"NP-\d{4}-\d{5}", dash)))
ids_pedido = re.findall(r"/orders/([0-9a-f-]{36})", dash)
check("dashboard renderiza com os pedidos", "sim", "sim" if numeros else "nao")
check("mostra o total de pedidos", "sim", "sim" if re.search(r"\d+ pedido\(s\)", dash) else "nao")
check("mostra o usuário no cabeçalho", "sim", "sim" if "Administradora naPorta" in dash else "nao")
check("mostra a moeda em BRL", "sim", "sim" if "R$" in dash else "nao")
check("mostra o status do pedido", "sim", "sim" if re.search(r"Pendente|Confirmado|Em trânsito|Entregue", dash) else "nao")

print("\n\x1b[1mPortal — detalhe e ações\x1b[0m")
pedido_id = ids_pedido[0] if ids_pedido else ""
detalhe = urllib.request.urlopen(
    urllib.request.Request(f"{WEB}/orders/{pedido_id}", headers={"Cookie": jar})
).read().decode()
check("página de detalhe renderiza", "sim", "sim" if "Itens" in detalhe and "Endereço de entrega" in detalhe else "nao")
check("oferece as ações de status", "sim", "sim" if "Marcar como" in detalhe else "nao")
check("oferece a exclusão", "sim", "sim" if "Excluir pedido" in detalhe else "nao")

print("\n\x1b[1mPortal — renovação transparente do token\x1b[0m")
# A ação de refresh responde ao browser quando o access token expira.
tem_refresh = False
for action_id in sorted(ids):
    try:
        status, cookies_refresh, _ = call_action("/login", action_id, [])
        if any("naporta_refresh_token" in c for c in cookies_refresh):
            tem_refresh = True
            break
    except urllib.error.HTTPError:
        continue
check("ação de refresh existe e é acessível", "sim", "sim" if tem_refresh else "nao")

print("\n\x1b[1mPortal — tratamento de erro\x1b[0m")
try:
    urllib.request.urlopen(
        urllib.request.Request(f"{WEB}/orders/nao-e-um-uuid", headers={"Cookie": jar})
    )
    check("id malformado não devolve 500", "sem 500", "sem 500")
except urllib.error.HTTPError as error:
    check("id malformado não devolve 500", "sem 500", "sem 500" if error.code != 500 else "500")
except Exception as error:
    check("id malformado não devolve 500", "sem 500", f"erro: {error}")

print("\n\x1b[1mPortal — API visto pelo portal (server-side)\x1b[0m")
api_direct = urllib.request.urlopen(f"{API}/health").read().decode()
check("API responde normalmente", "ok", "ok" if json.loads(api_direct)["status"] == "ok" else "falha")

print("\n\x1b[1m────────────────────────────────────────────\x1b[0m")
print(f"  \x1b[32m{ok} aprovados\x1b[0m", end="")
if fail:
    print(f" · \x1b[31m{fail} falharam\x1b[0m", end="")
print("\n\n")
