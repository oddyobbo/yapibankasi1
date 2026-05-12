(() => {
  const CATEGORIES = ["Akustik", "Aydınlatma", "Dış Cephe", "Zemin", "Tavan Sistemleri", "Mobilya"];

  const init = (async () => {
    const [
      supabaseClient,
      authModule,
      productModule,
      brandModule,
      architectModule,
      projectModule,
      moodboardModule,
      analyticsModule,
    ] = await Promise.all([
      import("./supabaseClient.js"),
      import("./authService.js"),
      import("./productService.js"),
      import("./brandService.js"),
      import("./architectService.js"),
      import("./projectService.js"),
      import("./moodboardService.js"),
      import("./analyticsService.js"),
    ]);

    const authService = authModule.createAuthService();
    const productService = productModule.createProductService();
    const projectService = projectModule.createProjectService();
    const architectService = architectModule.createArchitectService({
      ensureOwnProfile: authService.ensureOwnProfile,
      syncArchitectProfileFromMetadata: authService.syncArchitectProfileFromMetadata,
      getProjects: projectService.getProjects,
    });
    const brandService = brandModule.createBrandService({
      setArchitectSession: architectService.setArchitectSession,
    });
    const moodboardService = moodboardModule.createMoodboardService({
      getSessionArchitect: architectService.getSessionArchitect,
      getArchitectArray: architectService.getArchitectArray,
      setArchitectArray: architectService.setArchitectArray,
    });
    const analyticsService = analyticsModule.createAnalyticsService({
      getProducts: productService.getProducts,
    });

    Object.assign(window.AG, {
      ready: supabaseClient.ready,
      CATEGORIES,
      // brand
      loginBrand: brandService.loginBrand,
      registerBrand: brandService.registerBrand,
      logoutBrand: brandService.logoutBrand,
      getSessionBrand: brandService.getSessionBrand,
      // admin
      loginAdmin: authService.loginAdmin,
      logoutAdmin: authService.logoutAdmin,
      isAdmin: authService.isAdmin,
      // architect
      registerArchitect: architectService.registerArchitect,
      loginArchitect: architectService.loginArchitect,
      logoutArchitect: architectService.logoutArchitect,
      getSessionArchitect: architectService.getSessionArchitect,
      getFavoriteProducts: architectService.getFavoriteProducts,
      getFavoriteProjects: architectService.getFavoriteProjects,
      toggleFavoriteProduct: architectService.toggleFavoriteProduct,
      toggleFavoriteProject: architectService.toggleFavoriteProject,
      createCollection: moodboardService.createCollection,
      getCollections: moodboardService.getCollections,
      addCollectionItem: moodboardService.addCollectionItem,
      removeCollectionItem: moodboardService.removeCollectionItem,
      createMoodboard: moodboardService.createMoodboard,
      getMoodboards: moodboardService.getMoodboards,
      getMoodboard: moodboardService.getMoodboard,
      deleteMoodboard: moodboardService.deleteMoodboard,
      updateMoodboard: moodboardService.updateMoodboard,
      addProductToMoodboard: moodboardService.addProductToMoodboard,
      getArchitectOfficeProjects: architectService.getArchitectOfficeProjects,
      addArchitectOfficeProject: architectService.addArchitectOfficeProject,
      deleteArchitectOfficeProject: architectService.deleteArchitectOfficeProject,
      uploadArchitectProjectImage: architectService.uploadArchitectProjectImage,
      // products
      getProductList: productService.getProductList,
      getProductFilterOptions: productService.getProductFilterOptions,
      getProducts: productService.getProducts,
      getProductDetail: productService.getProductDetail,
      getAllProducts: productService.getAllProducts,
      addProduct: productService.addProduct,
      updateProduct: productService.updateProduct,
      deleteProduct: productService.deleteProduct,
      incrementView: productService.incrementView,
      getBrandProductAnalytics: analyticsService.getBrandProductAnalytics,
      trackEvent: analyticsService.trackEvent,
      uploadBrandAsset: brandService.uploadBrandAsset,
      uploadBrandImage: brandService.uploadBrandImage,
      uploadBrandDocument: brandService.uploadBrandDocument,
      getProjects: projectService.getProjects,
      addProject: projectService.addProject,
      // admin data
      getAllBrands: brandService.getAllBrands,
      getVisits: analyticsService.getVisits,
    });

    if (typeof window !== "undefined") {
      setTimeout(() => analyticsService.trackVisit(), 1500);
    }

    return supabaseClient.ready;
  })();

  const methodNames = [
    "loginBrand",
    "registerBrand",
    "logoutBrand",
    "getSessionBrand",
    "loginAdmin",
    "logoutAdmin",
    "isAdmin",
    "registerArchitect",
    "loginArchitect",
    "logoutArchitect",
    "getSessionArchitect",
    "getFavoriteProducts",
    "getFavoriteProjects",
    "toggleFavoriteProduct",
    "toggleFavoriteProject",
    "createCollection",
    "getCollections",
    "addCollectionItem",
    "removeCollectionItem",
    "createMoodboard",
    "getMoodboards",
    "getMoodboard",
    "deleteMoodboard",
    "updateMoodboard",
    "addProductToMoodboard",
    "getArchitectOfficeProjects",
    "addArchitectOfficeProject",
    "deleteArchitectOfficeProject",
    "uploadArchitectProjectImage",
    "getProductList",
    "getProductFilterOptions",
    "getProducts",
    "getProductDetail",
    "getAllProducts",
    "addProduct",
    "updateProduct",
    "deleteProduct",
    "incrementView",
    "getBrandProductAnalytics",
    "trackEvent",
    "uploadBrandAsset",
    "uploadBrandImage",
    "uploadBrandDocument",
    "getProjects",
    "addProject",
    "getAllBrands",
    "getVisits",
  ];

  const fallbackApi = {};
  methodNames.forEach((name) => {
    fallbackApi[name] = (...args) => init.then(() => window.AG[name](...args));
  });

  window.AG = {
    ...(window.AG || {}),
    ...fallbackApi,
    ready: init.then((ready) => ready),
    CATEGORIES,
  };
})();
