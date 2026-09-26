type CompletionClient = {
  from(table: 'profiles'): {
    update(value: { must_change_password: false }): {
      eq(column: 'id', id: string): {
        select(columns: 'id,must_change_password'): {
          maybeSingle(): PromiseLike<{ data: { id: string; must_change_password: boolean } | null; error: unknown }>;
        };
      };
    };
  };
};

// Receives a private capability from the server adapter, never credentials.
export async function completeRotation(client: CompletionClient, id: string) {
  const { data, error } = await client.from('profiles').update({ must_change_password: false })
    .eq('id', id).select('id,must_change_password').maybeSingle();
  return !error && data?.id === id && data.must_change_password === false;
}
