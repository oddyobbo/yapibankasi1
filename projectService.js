import { getSB, ready } from "./supabaseClient.js";
import { LS_PROJECTS_KEY, lsRead, lsWrite } from "./uiHelpers.js";

export const dbToProject = (row) => ({
  id: row.id,
  brandId: row.brand_id,
  brandName: row.brand_name || "",
  title: row.title || "",
  location: row.location || "",
  architect: row.architect || "",
  year: row.year || "",
  description: row.description || "",
  image: row.image || "",
  materials: row.materials || [],
  status: row.status || "published",
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
});

export const projectToDB = (project) => ({
  brand_id: project.brandId,
  brand_name: project.brandName || "",
  title: project.title || "",
  location: project.location || "",
  architect: project.architect || "",
  year: project.year || "",
  description: project.description || "",
  image: project.image || "",
  materials: project.materials || [],
  status: project.status || "published",
});

export const createProjectService = () => {
  const getProjects = async (opts = {}) => {
    await ready;
    const sb = getSB();
    if (sb) {
      try {
        let q = sb.from("projects").select("*").order("created_at", { ascending: false });
        if (opts.brandId) q = q.eq("brand_id", opts.brandId);
        const { data, error } = await q;
        if (!error) return (data || []).map(dbToProject);
      } catch {}
    }
    const local = lsRead(LS_PROJECTS_KEY, []);
    if (opts.brandId) return local.filter((p) => p.brandId === opts.brandId);
    return local;
  };

  const addProject = async (project) => {
    await ready;
    const sb = getSB();
    if (sb) {
      try {
        const { data, error } = await sb.from("projects").insert(projectToDB(project)).select().single();
        if (!error && data) return dbToProject(data);
      } catch {}
    }
    const local = lsRead(LS_PROJECTS_KEY, []);
    const created = { ...project, id: `p-${Date.now()}`, createdAt: Date.now() };
    local.unshift(created);
    lsWrite(LS_PROJECTS_KEY, local);
    return created;
  };

  return {
    getProjects,
    addProject,
  };
};
