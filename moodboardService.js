export const createMoodboardService = ({ getSessionArchitect, getArchitectArray, setArchitectArray }) => {
  const createCollection = async (name) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Koleksiyon oluşturmak için giriş yapın." };
    const safeName = (name || "").trim();
    if (!safeName) return { ok: false, message: "Koleksiyon adı zorunludur." };
    const list = getArchitectArray("collections", session.id, []);
    const created = { id: `col-${Date.now()}`, name: safeName, items: [], createdAt: Date.now() };
    list.unshift(created);
    setArchitectArray("collections", session.id, list);
    return { ok: true, collection: created };
  };

  const getCollections = async () => {
    const session = await getSessionArchitect();
    if (!session) return [];
    return getArchitectArray("collections", session.id, []);
  };

  const addCollectionItem = async ({ collectionId, item }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Giriş yapın." };
    const list = getArchitectArray("collections", session.id, []);
    const target = list.find((x) => x.id === collectionId);
    if (!target) return { ok: false, message: "Koleksiyon bulunamadı." };
    const itemType = item.type || "product";
    if (!target.items.some((x) => x.id === item.id && x.type === itemType)) {
      target.items.unshift({ ...item, type: itemType, addedAt: Date.now() });
    }
    setArchitectArray("collections", session.id, list);
    return { ok: true };
  };

  const removeCollectionItem = async ({ collectionId, itemId, type }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Giriş yapın." };
    const list = getArchitectArray("collections", session.id, []);
    const target = list.find((x) => x.id === collectionId);
    if (!target) return { ok: false, message: "Koleksiyon bulunamadı." };
    target.items = target.items.filter((x) => !(x.id === itemId && (!type || x.type === type)));
    setArchitectArray("collections", session.id, list);
    return { ok: true };
  };

  const createMoodboard = async ({ name }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Moodboard oluşturmak için giriş yapın." };
    const list = getArchitectArray("moodboards", session.id, []);
    const created = {
      id: `mb-${Date.now()}`,
      name: (name || "Yeni Moodboard").trim(),
      items: [],
      canvas: { width: 1400, height: 900 },
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    list.unshift(created);
    setArchitectArray("moodboards", session.id, list);
    return { ok: true, moodboard: created };
  };

  const getMoodboards = async () => {
    const session = await getSessionArchitect();
    if (!session) return [];
    return getArchitectArray("moodboards", session.id, []);
  };

  const getMoodboard = async (id) => {
    const list = await getMoodboards();
    return list.find((x) => x.id === id) || null;
  };

  const deleteMoodboard = async (id) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Giriş yapın." };
    if (!id) return { ok: false, message: "Pano bulunamadı." };
    const list = getArchitectArray("moodboards", session.id, []);
    const next = list.filter((x) => x.id !== id);
    if (next.length === list.length) return { ok: false, message: "Pano bulunamadı." };
    setArchitectArray("moodboards", session.id, next);
    return { ok: true };
  };

  const updateMoodboard = async (id, patch) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Giriş yapın." };
    const list = getArchitectArray("moodboards", session.id, []);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return { ok: false, message: "Moodboard bulunamadı." };
    list[idx] = {
      ...list[idx],
      ...patch,
      items: Array.isArray(patch.items) ? patch.items : list[idx].items,
      updatedAt: Date.now(),
    };
    setArchitectArray("moodboards", session.id, list);
    return { ok: true, moodboard: list[idx] };
  };

  const addProductToMoodboard = async ({ moodboardId, moodboardName, product }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Lütfen mimar girişi yapın." };
    const list = getArchitectArray("moodboards", session.id, []);
    let idx = list.findIndex((x) => x.id === moodboardId);

    if (idx < 0 && moodboardName) {
      const created = {
        id: `mb-${Date.now()}`,
        name: moodboardName.trim() || "Yeni Moodboard",
        items: [],
        canvas: { width: 1400, height: 900 },
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };
      list.unshift(created);
      idx = 0;
    }
    if (idx < 0) return { ok: false, message: "Moodboard bulunamadı." };

    const board = list[idx];
    const count = Array.isArray(board.items) ? board.items.length : 0;
    const created = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      name: product.name || "Ürün",
      image: product.image || "",
      x: 30 + (count % 6) * 220,
      y: 30 + Math.floor(count / 6) * 170,
      w: 220,
      h: 190,
    };
    board.items = Array.isArray(board.items) ? board.items : [];
    board.items.push(created);
    board.updatedAt = Date.now();
    list[idx] = board;
    setArchitectArray("moodboards", session.id, list);
    return { ok: true, moodboard: board };
  };

  return {
    createCollection,
    getCollections,
    addCollectionItem,
    removeCollectionItem,
    createMoodboard,
    getMoodboards,
    getMoodboard,
    deleteMoodboard,
    updateMoodboard,
    addProductToMoodboard,
  };
};
