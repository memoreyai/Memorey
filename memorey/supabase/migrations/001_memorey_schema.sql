-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  segment TEXT CHECK (segment IN ('founder','developer','consultant','researcher','other')),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CATEGORY VAULTS (the privacy isolation layer)
CREATE TABLE category_vaults (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#5DCAA5',
  is_custom BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MEMORY NODES (core data)
CREATE TABLE memory_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vault_id UUID NOT NULL REFERENCES category_vaults(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  value TEXT NOT NULL CHECK (char_length(value) <= 600),
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT DEFAULT 'manual' CHECK (source IN ('chat','share_link','manual','import','extension')),
  embedding VECTOR(1536),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NODE EDGES (connections between nodes)
CREATE TABLE node_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_node_id, target_node_id)
);

-- NODE HISTORY (immutable audit trail)
CREATE TABLE node_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_title TEXT,
  new_title TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  change_summary TEXT,
  triggered_by TEXT DEFAULT 'user' CHECK (triggered_by IN ('user','ai_extract','import')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SUBSCRIPTIONS
CREATE TABLE subscriptions (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE RLS ON ALL TABLES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (users can only access their own data)
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_own_vaults" ON category_vaults FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_nodes" ON memory_nodes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_edges" ON node_edges FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_history" ON node_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_subscription" ON subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PERFORMANCE INDEXES
CREATE INDEX idx_memory_nodes_user_vault ON memory_nodes(user_id, vault_id);
CREATE INDEX idx_memory_nodes_user_active ON memory_nodes(user_id, is_active);
CREATE INDEX idx_memory_nodes_embedding ON memory_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_node_edges_source ON node_edges(source_node_id);
CREATE INDEX idx_node_edges_target ON node_edges(target_node_id);
CREATE INDEX idx_node_history_node ON node_history(node_id, created_at DESC);
CREATE INDEX idx_category_vaults_user ON category_vaults(user_id, is_active);

-- TRIGGER: update updated_at on memory_nodes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_nodes_updated_at 
  BEFORE UPDATE ON memory_nodes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FUNCTION: seed default vaults for new user
CREATE OR REPLACE FUNCTION seed_default_vaults(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO category_vaults (user_id, name, color, display_order) VALUES
    (p_user_id, 'Work',          '#378ADD', 1),
    (p_user_id, 'Goals',         '#7F77DD', 2),
    (p_user_id, 'Personal',      '#5DCAA5', 3),
    (p_user_id, 'Health',        '#E05C5C', 4),
    (p_user_id, 'Finance',       '#EF9F27', 5),
    (p_user_id, 'Study',         '#D4537E', 6),
    (p_user_id, 'Relationships', '#38BDF8', 7),
    (p_user_id, 'Preferences',   '#888780', 8);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  
  INSERT INTO subscriptions (user_id, plan) VALUES (NEW.id, 'free');
  
  PERFORM seed_default_vaults(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: fire handle_new_user on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- FUNCTION: semantic search with vault isolation
CREATE OR REPLACE FUNCTION search_nodes(
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_vault_ids UUID[],
  p_limit INTEGER DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  vault_id UUID,
  title TEXT,
  value TEXT,
  confidence FLOAT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mn.id,
    mn.vault_id,
    mn.title,
    mn.value,
    mn.confidence,
    1 - (mn.embedding <=> p_query_embedding) AS similarity
  FROM memory_nodes mn
  WHERE mn.user_id = p_user_id
    AND mn.vault_id = ANY(p_vault_ids)
    AND mn.is_active = true
    AND mn.embedding IS NOT NULL
  ORDER BY mn.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: recursive graph traversal (up to 5 hops)
CREATE OR REPLACE FUNCTION get_connected_nodes(
  p_user_id UUID,
  p_node_id UUID,
  p_max_depth INTEGER DEFAULT 3
)
RETURNS TABLE (node_id UUID, depth INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE connected AS (
    SELECT ne.target_node_id AS node_id, 1 AS depth
    FROM node_edges ne
    WHERE ne.source_node_id = p_node_id AND ne.user_id = p_user_id
    UNION ALL
    SELECT ne.target_node_id, c.depth + 1
    FROM node_edges ne
    JOIN connected c ON ne.source_node_id = c.node_id
    WHERE c.depth < p_max_depth AND ne.user_id = p_user_id
  )
  SELECT DISTINCT node_id, MIN(depth) as depth 
  FROM connected 
  GROUP BY node_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
