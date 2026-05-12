import { getSB, ready } from "./supabaseClient.js";
import { LS_PROJECTS_KEY, lsRead, lsWrite } from "./uiHelpers.js";

const slugify = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i")
  .replace(/ğ/g, "g")
  .replace(/ü/g, "u")
  .replace(/ş/g, "s")
  .replace(/ö/g, "o")
  .replace(/ç/g, "c")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export const dbToProject = (row) => ({
  id: row.id,
  brandId: row.brand_id,
  architectId: row.architect_id,
  brandName: row.brand_name || "",
  title: row.title || "",
  slug: row.slug || "",
  location: row.location || "",
  city: row.city || "",
  country: row.country || "",
  architect: row.architect || "",
  officeName: row.office_name || "",
  year: row.year || "",
  description: row.description || "",
  image: row.image || "",
  materials: row.materials || [],
  status: row.status || "published",
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
});

export const projectToDB = (project) => ({
  brand_id: project.brandId || null,
  architect_id: project.architectId || null,
  brand_name: project.brandName || "",
  title: project.title || "",
  slug: project.slug || slugify(project.title),
  location: project.location || "",
  city: project.city || "",
  country: project.country || "",
  architect: project.architect || "",
  office_name: project.officeName || project.office_name || "",
  year: project.year || "",
  description: project.description || "",
  image: project.image || "",
  materials: Array.isArray(project.materials) ? project.materials : [],
  status: project.status || "published",
});

export const createProjectService = () => {
  const getProjects = async (opts = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) return lsRead(LS_PROJECTS_KEY, []);
    let q = sb.from("projects").select("*").order("created_at", { ascending: false });
    if (opts.brandId) q = q.eq("brand_id", opts.brandId);
    if (opts.architectId) q = q.eq("architect_id", opts.architectId);
    if (opts.status) q = q.eq("status", opts.status);
    if (opts.city) q = q.eq("city", opts.city);
    if (opts.country) q = q.eq("country", opts.country);
    const { data, error } = await q;
    if (error) return lsRead(LS_PROJECTS_KEY, []);
    return (data || []).map(dbToProject);
  };

  const addProject = async (project) => {
    await ready;
    const sb = getSB();
    if (!sb) {
      const list = lsRead(LS_PROJECTS_KEY, []);
      const local = {
        ...project,
        id: `local-${Date.now()}`,
        createdAt: Date.now(),
      };
      lsWrite(LS_PROJECTS_KEY, [local, ...list]);
      return local;
    }
    const { data, error } = await sb.from("projects").insert(projectToDB(project)).select("*").single();
    if (error) throw error;
    return dbToProject(data);
  };

  return { getProjects, addProject };
};
