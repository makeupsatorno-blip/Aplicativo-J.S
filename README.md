# J.S. — Julia Satorno

Aplicativo pessoal de organização: **Rotina**, **Autocuidado** (cronograma capilar), **Alimentação** e **Financeiro**, com painel inicial, agenda unificada, lembretes e backup.
Sem login e sem servidor: os dados ficam no próprio aparelho.

Ele é um app web (PWA): abre no navegador e pode ser **instalado no celular pelo Chrome**, com ícone na tela inicial, abrindo em tela cheia e funcionando sem internet.

---

## 1. Abrir no computador

**Jeito mais simples:** dê dois cliques em `index.html`. Ele abre no navegador e já funciona, salvando os dados.

**Para testar a instalação e o modo offline no computador:** com o Node instalado, rode na pasta `aplicativo`:

```
node servidor.js
```

e abra http://localhost:5190. Se a porta estiver ocupada: `set PORT=8080 && node servidor.js`.

## 2. Instalar no celular

O Chrome só instala apps que estão em um endereço **https**. Por isso a pasta `aplicativo` precisa ser publicada uma vez em uma hospedagem gratuita:

- **GitHub Pages** (usado neste projeto): o repositório é a própria pasta `aplicativo`. Em *Settings → Pages*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**. O app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
- **Netlify Drop** (alternativa): entre em https://app.netlify.com/drop, crie uma conta grátis e arraste a pasta `aplicativo` para a página. Você recebe um link `https://...netlify.app`.

No celular:

- **Android:** abra o link no **Chrome**, toque no menu **⋮** e escolha **Instalar app** (ou **Adicionar à tela inicial**). O J.S. também mostra um botão **Instalar** no painel quando o Chrome permite.
- **iPhone:** abra o link no **Safari**, toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.

### Publicar uma versão nova

Depois de alterar os arquivos, aumente o número em `sw.js` (`var VERSION = 'js-v1.3.1'`), faça o commit e envie (`git push`). O GitHub Pages atualiza em cerca de 1 minuto, e com internet o app sempre busca a versão mais recente.

## 3. Dados e backup — leia isto

- Os dados ficam **só no aparelho e no navegador onde foram cadastrados**. O que você cadastrar no computador não aparece no celular, e vice-versa.
- Limpar os dados do navegador, desinstalar o app ou perder o celular **apaga tudo**, a menos que exista um backup.
- Em **Configurações → Backup** dá para salvar um arquivo, enviá-lo por WhatsApp, e-mail ou Drive, e restaurá-lo em outro aparelho. O painel lembra de fazer backup a cada 14 dias.

## 4. Notificações

- O J.S. pede permissão na primeira vez que você cria um lembrete. Se você responder "Agora não", ele só volta a perguntar depois de 7 dias. Também dá para ativar em **Configurações**.
- Os avisos aparecem enquanto o app está aberto ou em segundo plano. **Com o app totalmente fechado, o celular pode não avisar na hora**: essa é uma limitação dos apps web sem servidor. Ao abrir o app, os lembretes das últimas 2 horas aparecem, e as pendências atrasadas ficam no painel.
- Funcionam melhor no Android com Chrome. No iPhone, só com o app instalado na tela de início (iOS 16.4 ou mais novo).
- Por privacidade, o valor das contas não aparece na notificação. Isso pode ser ligado em Configurações.

## 5. Logo e intro

- **Logo:** monograma "J S" entrelaçado dentro de um anel fino, em tons de rosa. Os arquivos ficam em `../logo/`: SVG vetorial em várias versões (fundo rosa, arredondada, transparente, branca e a assinatura "J.S.") e PNG em 1024 px. As letras são da fonte Cormorant Garamond Italic (licença livre OFL), convertidas em desenho, então não dependem da fonte instalada. As opções que foram comparadas estão em `../logo/opcoes-logo.html`.
- **Intro:** baseada na intro do Meu Financeiro IA, com cerca de 5,5 s de carregamento.
  - Animação da logo: um disco rosa surge, o anel se desenha, o J e o S são "escritos" (o contorno é traçado e depois a cor preenche), um brilho atravessa a logo e estrelinhas piscam em volta. Anéis giram ao redor.
  - Frases de carregamento com barra de progresso.
  - Interativa: tocar solta pétalas (e estende um pouco a intro), a logo se inclina seguindo o dedo, e "Pular" ou Esc entra direto.
  - Volta a aparecer quando o app é reaberto depois de 5 minutos fora.
  - Pode ser desligada em **Configurações → Aplicativo**, onde também há o botão "Ver a intro agora".
- **Animações do app** (`js/anim.js`):
  - As telas deslizam na direção da aba e os cartões aparecem em cascata.
  - Ao concluir, o ✓ pula e se desenha e o título é riscado. Com tudo do dia feito, caem pétalas.
  - Itens novos entram com brilho e excluídos encolhem e saem.
  - Conta paga brilha em verde e os totais do mês contam até o valor.
  - Registrar autocuidado solta pétalas.
  - Folhas, confirmações e avisos entram e saem suavemente.
- **Menos animação:** se o aparelho estiver configurado para mostrar menos animações (no Windows: *Configurações → Acessibilidade → Efeitos visuais → Efeitos de animação*), a logo continua animada, mas sem os anéis girando e as pétalas flutuando, e no resto do app as animações viram só esmaecimentos suaves. Para ver a versão completa mesmo assim, ligue **Animações sempre ligadas** em Configurações.

## 6. Testes

As regras de negócio têm testes automáticos: recorrência, centavos, contas recorrentes, lembretes e backup.

```
node --test testes/regras.test.js
```

## 7. Estrutura

```
aplicativo/
├── index.html              página única do app
├── manifest.webmanifest    nome, cores e ícones para a instalação
├── sw.js                   funcionamento offline e toque nas notificações
├── servidor.js             servidor local para testes (opcional)
├── css/style.css           visual (paleta do design system em ../JS_Starter/docs)
├── icons/                  ícones do app gerados a partir da logo
├── js/
│   ├── intro.js            intro animada e interativa
│   ├── anim.js             animações do app
│   ├── core.js             datas, dinheiro em centavos, rótulos
│   ├── regras.js           regras de negócio de todos os módulos (testadas)
│   ├── store.js            armazenamento local, migração e backup
│   ├── notify.js           lembretes e permissão de notificação
│   ├── ui.js               componentes de tela
│   ├── app.js              navegação, instalação e inicialização
│   └── telas/              inicio, rotina, autocuidado, alimentacao, financeiro, agenda, config
└── testes/regras.test.js
```

A especificação original está em `../JS_Starter/docs/`.

## 8. Fora desta versão

- Avisos garantidos com o app fechado (precisaria de um servidor de push).
- Sincronização entre aparelhos (precisaria de armazenamento em nuvem e consentimento).
