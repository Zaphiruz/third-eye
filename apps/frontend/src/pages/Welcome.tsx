import { useGetMeQuery, useUpdateMeMutation } from '../api';
import { ProfileForm } from '../components/ProfileForm';

export function Welcome() {
  const { data: me } = useGetMeQuery();
  const [updateMe] = useUpdateMeMutation();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-center text-4xl">Welcome</h1>
      <p className="mt-3 text-center text-mist/80">
        Each day, Third Eye draws tarot, casts a rune and the I Ching, and reads your stars and numbers — then an oracle weaves them into one fortune.
      </p>
      <div className="card mt-8">
        <ProfileForm initial={me?.profile} submitLabel="Begin" onSubmit={async (input) => { await updateMe(input).unwrap(); }} />
      </div>
    </div>
  );
}
