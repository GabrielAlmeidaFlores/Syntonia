import type { Language } from '@/stores/preferences';

/**
 * Master translations interface.
 * Every language must implement all keys — TypeScript enforces this at compile time.
 * Dynamic strings are typed as functions so the signature is also enforced across languages.
 */
interface Translations {
  nav: {
    feed: string;
    saved: string;
    profile: string;
    ariaMain: string;
  };
  feed: {
    readButton: string;
    ariaReadFull: string;
    ariaPost: (title: string) => string;
  };
  postDetail: {
    back: string;
    ariaBack: string;
    ariaShare: string;
    shareTitle: string;
    shareLink: string;
    shareCopy: string;
    shareCopied: string;
    ariaSave: string;
    ariaUnsave: string;
  };
  post: {
    notFound: string;
    backToFeed: string;
    back: string;
    ariaBack: string;
  };
  emptyFeed: {
    heading: string;
    description: string;
    configureButton: string;
    reloadButton: string;
  };
  feedLoading: {
    heading: string;
  };
  saved: {
    title: string;
    titleWithCount: (n: number) => string;
    emptyHeading: string;
    emptyDescription: string;
    noSavedPosts: string;
    backButton: string;
    ariaBack: string;
    ariaUnsave: string;
    ariaReadCard: (title: string) => string;
    toastSaved: string;
    toastUnsaved: string;
    toastSaveError: string;
    toastUnsaveError: string;
  };
  profile: {
    subtitle: string;
    tabProfile: string;
    tabSettings: string;
    logout: string;
    ariaLogout: string;
    logoutConfirmTitle: string;
    logoutConfirmMessage: string;
    logoutConfirmAction: string;
  };
  confirmModal: {
    cancel: string;
    unsaveTitle: string;
    unsaveMessage: string;
    unsaveAction: string;
  };
  descriptionForm: {
    label: string;
    hint: string;
    placeholder: string;
    charCount: (n: number) => string;
    saveButton: string;
    savingButton: string;
    toastSuccess: (n: number) => string;
    toastError: string;
  };
  tagManager: {
    empty: string;
    hintBefore: string;
    hintEmphasis: string;
    hintAfter: string;
    count: (active: number, total: number) => string;
    toastActivated: (tag: string) => string;
    toastDeactivated: (tag: string) => string;
    toastError: string;
  };
  settings: {
    themeLabel: string;
    themeHint: string;
    darkLabel: string;
    darkDescription: string;
    lightLabel: string;
    lightDescription: string;
    languageLabel: string;
    languageHint: string;
  };
  tagSelector: {
    ariaDisable: (tag: string) => string;
    ariaEnable: (tag: string) => string;
  };
  auth: {
    appTitle: string;
    appSubtitle: string;
    mockLabel: string;
    signinHeading: string;
    signinDescription: string;
    signinButton: string;
    signingInButton: string;
    errorMessage: string;
  };
  onboarding: {
    heading: string;
    description: string;
    descriptionLabel: string;
    placeholder: string;
    charHint: (n: number) => string;
    extractButton: string;
    analysing: string;
    extractError: string;
    saveError: string;
  };
  extractedTags: {
    status: string;
    description: string;
    count: (active: number, total: number) => string;
    confirmButton: string;
    savingButton: string;
    ariaDisable: (tag: string) => string;
    ariaEnable: (tag: string) => string;
  };
  legal: {
    tabLabel: string;
    termsTitle: string;
    privacyTitle: string;
    version: (v: string) => string;
    updatedAt: (d: string) => string;
    viewButton: string;
    loadingError: string;
    acceptTitle: string;
    acceptSubtitle: string;
    acceptCheckbox: string;
    acceptButton: string;
    acceptLoading: string;
  };
}

/**
 * Complete translations for all supported languages.
 * Adding a new language requires adding a new key that satisfies the Translations interface —
 * TypeScript will report every missing or mismatched string at compile time.
 */
export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      feed: 'Feed',
      saved: 'Saved',
      profile: 'Profile',
      ariaMain: 'Main navigation',
    },
    feed: {
      readButton: 'Read',
      ariaReadFull: 'Read full post',
      ariaPost: (title) => `Post: ${title}`,
    },
    postDetail: {
      back: 'Back',
      ariaBack: 'Go back to feed',
      ariaShare: 'Share post',
      shareTitle: 'Share post',
      shareLink: 'Post link',
      shareCopy: 'Copy link',
      shareCopied: 'Copied!',
      ariaSave: 'Save post',
      ariaUnsave: 'Remove from saved',
    },
    post: {
      notFound: 'Post not found',
      backToFeed: 'Back to feed',
      back: 'Back',
      ariaBack: 'Go back',
    },
    emptyFeed: {
      heading: 'No posts yet',
      description:
        'Your feed is generated based on your profile description and active tags. Configure your interests to start receiving personalised content.',
      configureButton: 'Configure my profile',
      reloadButton: 'Reload feed',
    },
    feedLoading: {
      heading: 'Generating your feed…',
    },
    saved: {
      title: 'Saved',
      titleWithCount: (n) => `Saved (${String(n)})`,
      emptyHeading: 'No saved posts yet',
      emptyDescription: 'Open any post and tap the bookmark icon to save it here.',
      noSavedPosts: 'No saved posts',
      backButton: 'Saved',
      ariaBack: 'Back to saved grid',
      ariaUnsave: 'Remove from saved',
      ariaReadCard: (title) => `Read: ${title}`,
      toastSaved: 'Post saved.',
      toastUnsaved: 'Post removed from saved.',
      toastSaveError: 'Failed to save post. Please try again.',
      toastUnsaveError: 'Failed to remove post. Please try again.',
    },
    profile: {
      subtitle: 'Syntonia profile',
      tabProfile: 'Profile',
      tabSettings: 'Settings',
      logout: 'Log out',
      ariaLogout: 'Log out',
      logoutConfirmTitle: 'Log out?',
      logoutConfirmMessage: 'You will need to sign in again to access your feed.',
      logoutConfirmAction: 'Log out',
    },
    confirmModal: {
      cancel: 'Cancel',
      unsaveTitle: 'Remove from saved?',
      unsaveMessage: 'This post will be removed from your saved list.',
      unsaveAction: 'Remove',
    },
    descriptionForm: {
      label: 'Profile description',
      hint: 'Describe your background and interests. Syntonia uses this to extract your areas of interest and generate relevant content.',
      placeholder: 'e.g. Backend developer working with AWS Lambda and TypeScript…',
      charCount: (n) => `${String(n)} / 500 characters`,
      saveButton: 'Save & extract tags',
      savingButton: 'Extracting…',
      toastSuccess: (n) => `Profile updated — ${String(n)} tags extracted.`,
      toastError: 'Failed to save profile. Please try again.',
    },
    tagManager: {
      empty: 'Save a profile description first to extract your areas of interest.',
      hintBefore: 'Toggle which extracted areas are active. Only',
      hintEmphasis: 'active tags',
      hintAfter: 'are used to generate your feed content.',
      count: (active, total) => `${String(active)} of ${String(total)} active`,
      toastActivated: (tag) => `"${tag}" activated.`,
      toastDeactivated: (tag) => `"${tag}" deactivated.`,
      toastError: 'Failed to update tags. Please try again.',
    },
    settings: {
      themeLabel: 'Theme',
      themeHint: 'Choose the visual style of the application.',
      darkLabel: 'Dark',
      darkDescription: 'Dark background, easy on the eyes at night',
      lightLabel: 'Light',
      lightDescription: 'Light background for bright environments',
      languageLabel: 'Language',
      languageHint: 'Select the language used for the interface.',
    },
    tagSelector: {
      ariaDisable: (tag) => `Disable ${tag}`,
      ariaEnable: (tag) => `Enable ${tag}`,
    },
    auth: {
      appTitle: 'Syntonia',
      appSubtitle: 'Personal Learning Engine',
      mockLabel: 'Mock Cognito Hosted UI',
      signinHeading: 'Sign in to continue',
      signinDescription:
        'In production, Cognito handles authentication. This simulates the OAuth redirect via POST /auth/callback intercepted by MSW.',
      signinButton: 'Continue with Cognito',
      signingInButton: 'Signing in…',
      errorMessage: 'Login failed. Please try again.',
    },
    onboarding: {
      heading: 'Set up your profile',
      description:
        "Describe your background and what you want to learn. Syntonia's AI will extract your areas of interest and personalise your feed.",
      descriptionLabel: 'Your profile description',
      placeholder:
        'e.g. Senior backend developer working with AWS Lambda and TypeScript. Building serverless APIs and learning Kubernetes.',
      charHint: (n) => `Minimum 20 characters · ${String(n)} / 500`,
      extractButton: 'Extract my interests',
      analysing: 'Analysing your profile with AI…',
      extractError: 'Failed to extract tags. Please try again.',
      saveError: 'Failed to save preferences. Please try again.',
    },
    extractedTags: {
      status: 'Tags extracted successfully',
      description:
        'Review your areas of interest. Only active tags (highlighted) will be used to generate your feed.',
      count: (active, total) => `${String(active)} of ${String(total)} tags active`,
      confirmButton: 'Start my feed',
      savingButton: 'Saving…',
      ariaDisable: (tag) => `Disable ${tag}`,
      ariaEnable: (tag) => `Enable ${tag}`,
    },
    legal: {
      tabLabel: 'Legal',
      termsTitle: 'Terms of Use',
      privacyTitle: 'Privacy Policy',
      version: (v) => `Version ${v}`,
      updatedAt: (d) => `Updated on ${d}`,
      viewButton: 'View',
      loadingError: 'Failed to load document. Please try again.',
      acceptTitle: 'Updated Terms',
      acceptSubtitle: 'We updated our Terms of Use and Privacy Policy. Please review and accept to continue using Syntonia.',
      acceptCheckbox: 'I have read and accept the Terms of Use and Privacy Policy.',
      acceptButton: 'Accept and continue',
      acceptLoading: 'Saving…',
    },
  },

  'pt-BR': {
    nav: {
      feed: 'Feed',
      saved: 'Salvos',
      profile: 'Perfil',
      ariaMain: 'Navegação principal',
    },
    feed: {
      readButton: 'Ler',
      ariaReadFull: 'Ler post completo',
      ariaPost: (title) => `Post: ${title}`,
    },
    postDetail: {
      back: 'Voltar',
      ariaBack: 'Voltar para o feed',
      ariaShare: 'Compartilhar post',
      shareTitle: 'Compartilhar post',
      shareLink: 'Link do post',
      shareCopy: 'Copiar link',
      shareCopied: 'Copiado!',
      ariaSave: 'Salvar post',
      ariaUnsave: 'Remover dos salvos',
    },
    post: {
      notFound: 'Post não encontrado',
      backToFeed: 'Voltar ao feed',
      back: 'Voltar',
      ariaBack: 'Voltar',
    },
    emptyFeed: {
      heading: 'Nenhum post ainda',
      description:
        'Seu feed é gerado com base na descrição do seu perfil e nas tags ativas. Configure seus interesses para começar a receber conteúdo personalizado.',
      configureButton: 'Configurar meu perfil',
      reloadButton: 'Recarregar feed',
    },
    feedLoading: {
      heading: 'Gerando o seu feed…',
    },
    saved: {
      title: 'Salvos',
      titleWithCount: (n) => `Salvos (${String(n)})`,
      emptyHeading: 'Nenhum post salvo ainda',
      emptyDescription: 'Abra qualquer post e toque no ícone de marcador para salvar aqui.',
      noSavedPosts: 'Nenhum post salvo',
      backButton: 'Salvos',
      ariaBack: 'Voltar para os salvos',
      ariaUnsave: 'Remover dos salvos',
      ariaReadCard: (title) => `Ler: ${title}`,
      toastSaved: 'Post salvo.',
      toastUnsaved: 'Post removido dos salvos.',
      toastSaveError: 'Falha ao salvar o post. Tente novamente.',
      toastUnsaveError: 'Falha ao remover o post. Tente novamente.',
    },
    profile: {
      subtitle: 'Perfil Syntonia',
      tabProfile: 'Perfil',
      tabSettings: 'Configurações',
      logout: 'Sair',
      ariaLogout: 'Sair da conta',
      logoutConfirmTitle: 'Sair da conta?',
      logoutConfirmMessage: 'Você precisará fazer login novamente para acessar o seu feed.',
      logoutConfirmAction: 'Sair',
    },
    confirmModal: {
      cancel: 'Cancelar',
      unsaveTitle: 'Remover dos salvos?',
      unsaveMessage: 'Este post será removido da sua lista de salvos.',
      unsaveAction: 'Remover',
    },
    descriptionForm: {
      label: 'Descrição do perfil',
      hint: 'Descreva seu background e interesses. O Syntonia usa isso para extrair suas áreas de interesse e gerar conteúdo relevante.',
      placeholder: 'ex: Desenvolvedor backend trabalhando com AWS Lambda e TypeScript…',
      charCount: (n) => `${String(n)} / 500 caracteres`,
      saveButton: 'Salvar & extrair tags',
      savingButton: 'Extraindo…',
      toastSuccess: (n) => `Perfil atualizado — ${String(n)} tags extraídas.`,
      toastError: 'Falha ao salvar o perfil. Por favor, tente novamente.',
    },
    tagManager: {
      empty: 'Salve uma descrição de perfil primeiro para extrair suas áreas de interesse.',
      hintBefore: 'Ative ou desative suas áreas extraídas. Apenas as',
      hintEmphasis: 'tags ativas',
      hintAfter: 'são usadas para gerar o conteúdo do seu feed.',
      count: (active, total) => `${String(active)} de ${String(total)} ativas`,
      toastActivated: (tag) => `"${tag}" ativada.`,
      toastDeactivated: (tag) => `"${tag}" desativada.`,
      toastError: 'Falha ao atualizar tags. Por favor, tente novamente.',
    },
    settings: {
      themeLabel: 'Tema',
      themeHint: 'Escolha o estilo visual do aplicativo.',
      darkLabel: 'Escuro',
      darkDescription: 'Fundo escuro, confortável para os olhos à noite',
      lightLabel: 'Claro',
      lightDescription: 'Fundo claro para ambientes com boa iluminação',
      languageLabel: 'Idioma',
      languageHint: 'Selecione o idioma da interface.',
    },
    tagSelector: {
      ariaDisable: (tag) => `Desativar ${tag}`,
      ariaEnable: (tag) => `Ativar ${tag}`,
    },
    auth: {
      appTitle: 'Syntonia',
      appSubtitle: 'Motor de Aprendizado Pessoal',
      mockLabel: 'Mock Cognito Hosted UI',
      signinHeading: 'Entrar para continuar',
      signinDescription:
        'Em produção, o Cognito cuida da autenticação. Isso simula o redirecionamento OAuth via POST /auth/callback interceptado pelo MSW.',
      signinButton: 'Continuar com Cognito',
      signingInButton: 'Entrando…',
      errorMessage: 'Falha no login. Por favor, tente novamente.',
    },
    onboarding: {
      heading: 'Configure seu perfil',
      description:
        'Descreva seu background e o que você quer aprender. A IA do Syntonia vai extrair suas áreas de interesse e personalizar o seu feed.',
      descriptionLabel: 'Sua descrição de perfil',
      placeholder:
        'ex: Desenvolvedor backend sênior com AWS Lambda e TypeScript. Construindo APIs serverless e aprendendo Kubernetes.',
      charHint: (n) => `Mínimo de 20 caracteres · ${String(n)} / 500`,
      extractButton: 'Extrair meus interesses',
      analysing: 'Analisando seu perfil com IA…',
      extractError: 'Falha ao extrair tags. Por favor, tente novamente.',
      saveError: 'Falha ao salvar preferências. Por favor, tente novamente.',
    },
    extractedTags: {
      status: 'Tags extraídas com sucesso',
      description:
        'Revise suas áreas de interesse. Apenas as tags ativas (destacadas) serão usadas para gerar o seu feed.',
      count: (active, total) => `${String(active)} de ${String(total)} tags ativas`,
      confirmButton: 'Iniciar meu feed',
      savingButton: 'Salvando…',
      ariaDisable: (tag) => `Desativar ${tag}`,
      ariaEnable: (tag) => `Ativar ${tag}`,
    },
    legal: {
      tabLabel: 'Legal',
      termsTitle: 'Termos de Uso',
      privacyTitle: 'Política de Privacidade',
      version: (v) => `Versão ${v}`,
      updatedAt: (d) => `Atualizado em ${d}`,
      viewButton: 'Ver',
      loadingError: 'Falha ao carregar o documento. Tente novamente.',
      acceptTitle: 'Termos Atualizados',
      acceptSubtitle: 'Atualizamos nossos Termos de Uso e Política de Privacidade. Leia e aceite para continuar usando o Syntonia.',
      acceptCheckbox: 'Li e aceito os Termos de Uso e a Política de Privacidade.',
      acceptButton: 'Aceitar e continuar',
      acceptLoading: 'Salvando…',
    },
  },
};
