import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/notify';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import type { PaymentRecipient } from '@/types/celina2';
import {
  createRecipientSchema,
  editRecipientSchema,
  type CreateRecipientFormData,
  type EditRecipientFormData,
} from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, Search, Pencil, Trash2, X, Check } from 'lucide-react';
import { asArray } from '@/utils/formatters';

function normalizeValue(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

// Generate a consistent color from a name
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  const colors = [
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
    'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const createForm = useForm<CreateRecipientFormData>({
    resolver: zodResolver(createRecipientSchema),
    defaultValues: {
      name: '',
      accountNumber: '',
    },
  });

  const editForm = useForm<EditRecipientFormData>({
    resolver: zodResolver(editRecipientSchema),
    defaultValues: {
      name: '',
      accountNumber: '',
    },
  });

  const loadRecipients = async () => {
    setLoading(true);

    try {
      const data = await paymentRecipientService.getAll();
      setRecipients(asArray<PaymentRecipient>(data));
    } catch {
      toast.error('Neuspesno ucitavanje primalaca.');
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipients();
  }, []);

  const filteredRecipients = useMemo(() => {
    const term = normalizeValue(searchTerm);
    const safeRecipients = asArray<PaymentRecipient>(recipients);

    if (!term) return safeRecipients;

    return safeRecipients.filter((recipient) => {
      const name = normalizeValue(recipient.name);
      const accountNumber = normalizeValue(recipient.accountNumber);

      return (
        name.includes(term) ||
        accountNumber.includes(term)
      );
    });
  }, [recipients, searchTerm]);

  const handleToggleCreateForm = () => {
    const nextValue = !showCreateForm;
    setShowCreateForm(nextValue);

    if (!nextValue) {
      createForm.reset({
        name: '',
        accountNumber: '',
      });
    }
  };

  const handleCreate = async (data: CreateRecipientFormData) => {
    setCreating(true);

    try {
      await paymentRecipientService.create({
        name: data.name.trim(),
        accountNumber: data.accountNumber.trim(),
      });

      toast.success('Primalac je uspesno dodat.');
      createForm.reset({
        name: '',
        accountNumber: '',
      });
      setShowCreateForm(false);
      await loadRecipients();
    } catch {
      toast.error('Dodavanje primaoca nije uspelo.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (recipient: PaymentRecipient) => {
    setEditingRecipientId(recipient.id);

    editForm.reset({
      name: recipient.name,
      accountNumber: recipient.accountNumber,
    });
  };

  const cancelEdit = () => {
    setEditingRecipientId(null);
    editForm.reset({
      name: '',
      accountNumber: '',
    });
  };

  const handleEdit = async (data: EditRecipientFormData) => {
    if (!editingRecipientId) return;

    setUpdating(true);

    try {
      await paymentRecipientService.update(editingRecipientId, {
        name: data.name.trim(),
        accountNumber: data.accountNumber.trim(),
      });

      toast.success('Primalac je uspesno izmenjen.');
      cancelEdit();
      await loadRecipients();
    } catch {
      toast.error('Izmena primaoca nije uspela.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (recipient: PaymentRecipient) => {
    const confirmed = window.confirm(
      `Da li ste sigurni da zelite da obrisete primaoca "${recipient.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(recipient.id);

    try {
      await paymentRecipientService.delete(recipient.id);
      toast.success('Primalac je obrisan.');

      if (editingRecipientId === recipient.id) {
        cancelEdit();
      }

      await loadRecipients();
    } catch {
      toast.error('Brisanje primaoca nije uspelo.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Primaoci placanja</h1>
            <p className="text-sm text-muted-foreground">Upravljajte listom sacuvanih primalaca za brza placanja.</p>
          </div>
        </div>

        <Button
          onClick={handleToggleCreateForm}
          className={showCreateForm ? 'rounded-xl' : 'rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all'}
          variant={showCreateForm ? 'outline' : 'default'}
          size="lg"
        >
          {showCreateForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Zatvori
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Dodaj primaoca
            </>
          )}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card className="rounded-2xl border shadow-sm border-indigo-200 dark:border-indigo-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                <UserPlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle className="text-base">Novi primalac</CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={createForm.handleSubmit(handleCreate)}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="create-name">Ime primaoca</Label>
                <Input
                  id="create-name"
                  placeholder="npr. Marko Petrovic"
                  {...createForm.register('name')}
                  disabled={creating}
                  className="h-12 rounded-xl"
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-account">Broj racuna</Label>
                <Input
                  id="create-account"
                  placeholder="18 cifara"
                  {...createForm.register('accountNumber')}
                  disabled={creating}
                  className="h-12 rounded-xl font-mono"
                />
                {createForm.formState.errors.accountNumber && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.accountNumber.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={creating}
                  className="h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                >
                  {creating ? 'Cuvanje...' : 'Sacuvaj primaoca'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Pretraga po imenu ili broju racuna..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-14 rounded-2xl pl-12 text-base shadow-sm border"
        />
      </div>

      {/* Recipients list */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-48 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredRecipients.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {searchTerm.trim() ? 'Nema rezultata pretrage' : 'Nema sacuvanih primalaca'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                {searchTerm.trim()
                  ? 'Nema primalaca koji odgovaraju pretrazi.'
                  : 'Dodajte prvog primaoca klikom na dugme iznad.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRecipients.map((recipient) => {
            const isEditing = editingRecipientId === recipient.id;
            const isDeleting = deletingId === recipient.id;
            const avatarColor = getAvatarColor(recipient.name);
            const initials = getInitials(recipient.name);

            if (isEditing) {
              return (
                <Card key={recipient.id} className="rounded-2xl border-2 border-indigo-500/30 shadow-md">
                  <CardContent className="pt-6 pb-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-bold text-lg ${avatarColor}`}>
                        {initials}
                      </div>
                      <span className="text-sm text-muted-foreground">Izmena primaoca</span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor={`edit-name-${recipient.id}`} className="text-xs">Ime</Label>
                        <Input
                          id={`edit-name-${recipient.id}`}
                          placeholder="Ime"
                          {...editForm.register('name')}
                          disabled={updating}
                          className="h-11 rounded-xl"
                        />
                        {editForm.formState.errors.name && (
                          <p className="text-xs text-destructive">
                            {editForm.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`edit-account-${recipient.id}`} className="text-xs">Racun</Label>
                        <Input
                          id={`edit-account-${recipient.id}`}
                          placeholder="Broj racuna"
                          {...editForm.register('accountNumber')}
                          disabled={updating}
                          className="h-11 rounded-xl font-mono"
                        />
                        {editForm.formState.errors.accountNumber && (
                          <p className="text-xs text-destructive">
                            {editForm.formState.errors.accountNumber.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={editForm.handleSubmit(handleEdit)}
                        disabled={updating}
                        className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {updating ? 'Cuvanje...' : 'Sacuvaj'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={updating}
                        className="rounded-xl"
                      >
                        Otkazi
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card key={recipient.id} className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 group">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-bold text-lg ${avatarColor}`}>
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{recipient.name}</p>
                      <p className="text-sm font-mono text-muted-foreground mt-0.5 truncate">{recipient.accountNumber}</p>
                    </div>

                    {/* Actions - visible on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        onClick={() => startEdit(recipient)}
                        disabled={isDeleting}
                        className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors"
                        title="Izmeni"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(recipient)}
                        disabled={isDeleting}
                        className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Obrisi"
                      >
                        <Trash2 className={`h-4 w-4 ${isDeleting ? 'text-muted-foreground animate-pulse' : 'text-red-500'}`} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
