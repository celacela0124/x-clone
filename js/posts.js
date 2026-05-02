async function createPost(content, userId) {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 280) return { error: '内容を入力してください（280文字以内）' };

  const { data, error } = await supabase
    .from('posts')
    .insert({ content: trimmed, user_id: userId })
    .select('*, profiles(username, display_name)')
    .single();

  return { data, error };
}
