#!/usr/bin/env bash
# Bateria completa de verificação do sistema naPorta.
set -uo pipefail

API=http://localhost:3000/api/v1
WEB=http://localhost:3001
ok=0
fail=0

check() { # check <descrição> <esperado> <obtido>
  if [ "$2" = "$3" ]; then
    printf '  \033[32m✓\033[0m %-52s %s\n' "$1" "$3"
    ok=$((ok + 1))
  else
    printf '  \033[31m✗\033[0m %-52s esperado: %s · obtido: %s\n' "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Login com espera: as rotas de credencial têm rate limit de 5/min.
login() {
  local email="$1" password="$2" resposta
  for tentativa in 1 2 3; do
    resposta=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
      -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    local token
    token=$(echo "$resposta" | jq -r '.accessToken // empty')
    if [ -n "$token" ]; then
      echo "$token"
      return 0
    fi
    echo "   (rate limit atingido — aguardando 65s)" >&2
    sleep 65
  done
  echo ""
  return 1
}

# ---------------------------------------------------------------- 1. health
section '1. Health checks'
check 'liveness (/health)' 200 "$(curl -s -o /dev/null -w '%{http_code}' $API/health)"
check 'readiness (/health/ready)' 200 "$(curl -s -o /dev/null -w '%{http_code}' $API/health/ready)"

# ------------------------------------------------------- 2. autenticação
section '2. Autenticação JWT'
ADMIN=$(login admin@naporta.local 'Admin@1234')
OPERADOR=$(login operador@naporta.local 'Operador@1234')

check 'login admin devolve token' 'ok' "$([ -n "$ADMIN" ] && echo ok || echo vazio)"
check 'login operador devolve token' 'ok' "$([ -n "$OPERADOR" ] && echo ok || echo vazio)"
check 'sem token → 401' 401 "$(curl -s -o /dev/null -w '%{http_code}' $API/auth/me)"
check 'token inválido → 401' 401 "$(curl -s -o /dev/null -w '%{http_code}' $API/auth/me -H 'Authorization: Bearer invalido.invalido')"
check 'esquema errado → 401' 401 "$(curl -s -o /dev/null -w '%{http_code}' $API/auth/me -H 'Authorization: Basic dXNlcjpwYXNz')"
check '/auth/me autenticado → 200' 200 "$(curl -s -o /dev/null -w '%{http_code}' $API/auth/me -H "Authorization: Bearer $ADMIN")"
check 'senha errada → 401' 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@naporta.local","password":"errada"}')"
check 'e-mail inexistente → 401 (mesma msg)' 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"ninguem@naporta.local","password":"Admin@1234"}')"
REFRESH_INVALIDO='token-invalido-com-tamanho-suficiente'
check 'refresh com token inválido → 401' 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH_INVALIDO\"}")"
check 'refresh com token curto → 422 (DTO)' 422 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"curto"}')"

# ------------------------------------------------------------ 3. pedidos
section '3. CRUD de pedidos'
PEDIDO=$(curl -s -X POST $API/orders -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"expectedDeliveryDate":"2027-08-20","customerName":"Empresa Alfa","customerDocument":"11144477735","address":{"street":"Rua das Flores","number":"123","neighborhood":"Centro","city":"Sao Paulo","state":"SP","zipCode":"01001000"},"items":[{"description":"Caixa","quantity":2,"unitPrice":49.9}]}')
PID=$(echo "$PEDIDO" | jq -r .id)
PNUM=$(echo "$PEDIDO" | jq -r .number)

check 'cria pedido → 201 com número' 'NP-2026-00001' "$(echo "$PNUM" | grep -qE '^NP-[0-9]{4}-[0-9]{5}$' && echo 'NP-2026-00001' || echo "$PNUM")"
check 'total calculado no servidor' 99.8 "$(echo "$PEDIDO" | jq -r .total)"
check 'status inicial PENDING' PENDING "$(echo "$PEDIDO" | jq -r .status)"
check 'detalha pedido → 200' 200 "$(curl -s -o /dev/null -w '%{http_code}' $API/orders/$PID -H "Authorization: Bearer $ADMIN")"
check 'id inexistente → 404' 404 "$(curl -s -o /dev/null -w '%{http_code}' $API/orders/$(uuidgen) -H "Authorization: Bearer $ADMIN")"
check 'id não-uuid → 400' 400 "$(curl -s -o /dev/null -w '%{http_code}' $API/orders/nao-e-uuid -H "Authorization: Bearer $ADMIN")"
check 'edita pedido → 200' 200 "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/orders/$PID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"customerName":"Empresa Alfa Ltda"}')"
check 'total recalcula ao trocar itens' 30 "$(curl -s -X PATCH $API/orders/$PID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"items":[{"description":"Item","quantity":3,"unitPrice":"10.00"}]}' | jq -r .total)"

section '4. Transições de status'
check 'PENDING → CONFIRMED' CONFIRMED "$(curl -s -X PATCH $API/orders/$PID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"status":"CONFIRMED"}' | jq -r .status)"
check 'pular etapa → 409' 409 "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/orders/$PID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"status":"DELIVERED"}')"
check 'CONFIRMED → PROCESSING → SHIPPED → DELIVERED' DELIVERED "$(for s in PROCESSING SHIPPED DELIVERED; do curl -s -o /dev/null -X PATCH $API/orders/$PID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"status\":\"$s\"}"; done; curl -s $API/orders/$PID -H "Authorization: Bearer $ADMIN" | jq -r .status)"
check 'sair de status final → 409' 409 "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/orders/$PID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"status":"PENDING"}')"

section '5. Filtros e paginação'
check 'filtro por número' 1 "$(curl -s "$API/orders?number=$PNUM" -H "Authorization: Bearer $ADMIN" | jq -r .meta.total)"
check 'filtro por status' 1 "$(curl -s "$API/orders?status=DELIVERED&number=$PNUM" -H "Authorization: Bearer $ADMIN" | jq -r .meta.total)"
check 'filtro por período (inclui)' 1 "$(curl -s "$API/orders?startDate=2027-01-01&endDate=2027-12-31&number=$PNUM" -H "Authorization: Bearer $ADMIN" | jq -r .meta.total)"
check 'filtro por período (exclui)' 0 "$(curl -s "$API/orders?startDate=2028-01-01&number=$PNUM" -H "Authorization: Bearer $ADMIN" | jq -r .meta.total)"
check 'paginação (limit=1)' 1 "$(curl -s "$API/orders?limit=1" -H "Authorization: Bearer $ADMIN" | jq -r '.data | length')"
check 'ordem por total desc' 'ok' "$(curl -s "$API/orders?sortBy=total&order=desc&limit=5" -H "Authorization: Bearer $ADMIN" | jq -r '[.data[].total] | (. == (.|sort|reverse)) | if . then "ok" else "falha" end')"
check 'sortBy inválido → 422' 422 "$(curl -s -o /dev/null -w '%{http_code}' "$API/orders?sortBy=dropTable" -H "Authorization: Bearer $ADMIN")"
check 'limit acima do máximo → 422' 422 "$(curl -s -o /dev/null -w '%{http_code}' "$API/orders?limit=1000" -H "Authorization: Bearer $ADMIN")"

section '6. Propriedade e papéis'
check 'operador vê os próprios pedidos' 'ok' "$(curl -s "$API/orders?limit=1" -H "Authorization: Bearer $OPERADOR" | jq -r 'if .data then "ok" else "falha" end')"
check 'operador não acessa pedido alheio → 404' 404 "$(curl -s -o /dev/null -w '%{http_code}' $API/orders/$PID -H "Authorization: Bearer $OPERADOR")"
check 'operador em /users → 403' 403 "$(curl -s -o /dev/null -w '%{http_code}' $API/users -H "Authorization: Bearer $OPERADOR")"
check 'admin em /users → 200' 200 "$(curl -s -o /dev/null -w '%{http_code}' $API/users -H "Authorization: Bearer $ADMIN")"
check '/users nunca expõe passwordHash' 'ok' "$(curl -s $API/users -H "Authorization: Bearer $ADMIN" | grep -q passwordHash && echo FALHA || echo ok)"

section '7. Validação e contrato de erro'
check 'CPF inválido → 422' 422 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/orders -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"expectedDeliveryDate":"2027-01-01","customerName":"X","customerDocument":"11144477734","address":{"street":"a","number":"1","neighborhood":"b","city":"c","state":"SP","zipCode":"01001000"},"items":[{"description":"i","quantity":1,"unitPrice":1}]}')"
check 'sem itens → 422' 422 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/orders -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"expectedDeliveryDate":"2027-01-01","customerName":"X","customerDocument":"11144477735","address":{"street":"a","number":"1","neighborhood":"b","city":"c","state":"SP","zipCode":"01001000"},"items":[]}')"
check 'campo desconhecido → 422' 422 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/orders -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"expectedDeliveryDate":"2027-01-01","customerName":"X","customerDocument":"11144477735","total":10,"address":{"street":"a","number":"1","neighborhood":"b","city":"c","state":"SP","zipCode":"01001000"},"items":[{"description":"i","quantity":1,"unitPrice":1}]}')"
check 'data no passado → 400' 400 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/orders -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"expectedDeliveryDate":"2020-01-01","customerName":"Cliente Valido","customerDocument":"11144477735","address":{"street":"Rua Valida","number":"123","neighborhood":"Centro","city":"Sao Paulo","state":"SP","zipCode":"01001000"},"items":[{"description":"Item valido","quantity":1,"unitPrice":10}]}')"
check 'erro tem contrato único' 'ok' "$(curl -s $API/orders/nao-e-uuid -H "Authorization: Bearer $ADMIN" | jq -r 'if (.statusCode and .error and .message and .path and .timestamp) then "ok" else "falha" end')"
check 'erro 404 de pedido traz requestId' 'ok' "$(curl -s $API/orders/$(uuidgen) -H "Authorization: Bearer $ADMIN" | jq -r 'if .requestId then "ok" else "falha" end')"

section '8. Exclusão lógica'
check 'DELETE → 204' 204 "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $API/orders/$PID -H "Authorization: Bearer $ADMIN")"
check 'GET depois → 404' 404 "$(curl -s -o /dev/null -w '%{http_code}' $API/orders/$PID -H "Authorization: Bearer $ADMIN")"
check 'linha permanece no banco' 'sim' "$(docker compose exec -T db psql -U naporta -d naporta -tAc "SELECT CASE WHEN deleted_at IS NOT NULL THEN 'sim' ELSE 'nao' END FROM orders WHERE id='$PID'::uuid" 2>/dev/null)"

section '9. Documentação e portal'
check 'Swagger UI (/docs)' 200 "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/docs)"
check 'OpenAPI (/docs-json)' 200 "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/docs-json)"
check 'portal /login' 200 "$(curl -s -o /dev/null -w '%{http_code}' $WEB/login)"
check 'portal / sem sessão → 307' 307 "$(curl -s -o /dev/null -w '%{http_code}' $WEB/)"
check 'portal /orders/new sem sessão → 307' 307 "$(curl -s -o /dev/null -w '%{http_code}' $WEB/orders/new)"
check 'CORS libera a origem do portal' 'ok' "$(curl -s -o /dev/null -D - -H "Origin: http://localhost:3001" "$API/health" | grep -qi 'access-control-allow-origin: http://localhost:3001' && echo ok || echo falha)"

section '10. Rate limit (5/min nas rotas de credencial)'
RATE_STATUS=''
for tentativa in $(seq 1 7); do
  RATE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@naporta.local","password":"Admin@1234"}')
done
check '7 tentativas seguidas → a última é 429' 429 "$RATE_STATUS"

printf '\n\033[1m%s\033[0m\n' '────────────────────────────────────────────'
printf '  \033[32m%d aprovados\033[0m' "$ok"
[ "$fail" -gt 0 ] && printf ' · \033[31m%d falharam\033[0m' "$fail"
printf '\n\n'
exit $((fail > 0))
