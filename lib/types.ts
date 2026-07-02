export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Extension {
  id: number;
  project_id: number;
  ext_id: string;
  name: string;
  slug: string;
  icon: string;
  rating: number | null;
  rating_count: number | null;
  users: string;
  description: string;
  category: string;
  website: string;
  role: "mine" | "competitor";
  last_fetched: string | null;
  created_at: string;
}

export interface Review {
  id: number;
  extension_id: number;
  review_uid: string;
  author: string;
  rating: number | null;
  body: string;
  date: string;
  created_at: string;
}
