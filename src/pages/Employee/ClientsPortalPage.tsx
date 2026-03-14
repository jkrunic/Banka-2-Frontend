import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { clientService } from '@/services/clientService';
import type { Client, PaginatedResponse } from '@/types';
import type { Account, ClientFilters } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PAGE_SIZE = 10;
const ACCOUNTS_PAGE_SIZE = 20;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function getErrorMessage(defaultMessage: string, error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response !== null &&
    'status' in ((error as { response?: { status?: unknown } }).response ?? {})
  ) {
    const status = (error as { response?: { status?: number } }).response?.status;

    if (status === 403) {
      return 'Nemate dozvolu za pristup ovoj funkcionalnosti.';
    }

    if (status === 404) {
      return 'Traženi resurs nije pronađen.';
    }
  }

  return defaultMessage;
}

type EditFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  dateOfBirth: string;
  gender: string;
};

const emptyEditForm: EditFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  address: '',
  dateOfBirth: '',
  gender: '',
};

function mapClientToEditForm(client: Client): EditFormState {
  return {
    firstName: client.firstName ?? '',
    lastName: client.lastName ?? '',
    email: client.email ?? '',
    phoneNumber: client.phoneNumber ?? '',
    address: client.address ?? '',
    dateOfBirth: client.dateOfBirth ?? '',
    gender: client.gender ?? '',
  };
}

export default function ClientsPortalPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [clients, setClients] = useState<Client[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAccounts, setClientAccounts] = useState<Account[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);

  const selectedClientId = useMemo(() => {
    const parsed = Number(id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [id]);

  const filters = useMemo<ClientFilters>(
    () => ({
      firstName: search || undefined,
      lastName: search || undefined,
      email: search || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [page, search]
  );

  const fillEditForm = (client: Client) => {
    setEditForm(mapClientToEditForm(client));
  };

  const resetDetailsState = () => {
    setSelectedClient(null);
    setClientAccounts([]);
    setIsEditing(false);
    setEditForm(emptyEditForm);
  };

  const loadClients = async () => {
    setListLoading(true);

    try {
      const response: PaginatedResponse<Client> = await clientService.getAll(filters);
      setClients(asArray<Client>(response.content));
      setTotalPages(Math.max(1, response.totalPages ?? 1));
    } catch (error) {
      setClients([]);
      setTotalPages(1);
      toast.error(getErrorMessage('Neuspešno učitavanje klijenata.', error));
    } finally {
      setListLoading(false);
    }
  };

  const loadClientAccounts = async (clientEmail: string) => {
    const accountsResponse = await accountService.getAll({
      ownerEmail: clientEmail,
      page: 0,
      limit: ACCOUNTS_PAGE_SIZE,
    });

    return asArray<Account>(accountsResponse.content);
  };

  const loadClientFromRoute = async (clientId: number) => {
    setDetailsLoading(true);

    try {
      const client = await clientService.getById(clientId);
      setSelectedClient(client);
      fillEditForm(client);
      setIsEditing(false);

      const accounts = await loadClientAccounts(client.email);
      setClientAccounts(accounts);
    } catch (error) {
      resetDetailsState();
      toast.error(getErrorMessage('Neuspešno učitavanje klijenta iz rute.', error));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenDetails = (clientId: number) => {
    navigate(`/employee/clients/${clientId}`);
  };

  const handleBackToList = () => {
    navigate('/employee/clients');
  };

  const handleEditFieldChange =
    (field: keyof EditFormState) => (e: ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setEditForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleStartEdit = () => {
    if (!selectedClient) return;
    fillEditForm(selectedClient);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!selectedClient) return;
    fillEditForm(selectedClient);
    setIsEditing(false);
  };

  const saveClient = async () => {
    if (!selectedClient) return;

    setSaving(true);

    try {
      const updatedClient = await clientService.update(selectedClient.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phoneNumber: editForm.phoneNumber,
        address: editForm.address,
        dateOfBirth: editForm.dateOfBirth,
        gender: editForm.gender,
      });

      setSelectedClient(updatedClient);
      fillEditForm(updatedClient);
      setIsEditing(false);
      toast.success('Klijent uspešno izmenjen.');

      await loadClients();
      const accounts = await loadClientAccounts(updatedClient.email);
      setClientAccounts(accounts);
    } catch (error) {
      toast.error(getErrorMessage('Izmena klijenta nije uspela.', error));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    loadClients();
  }, [filters]);

  useEffect(() => {
    if (!id) {
      resetDetailsState();
      return;
    }

    if (!selectedClientId) {
      resetDetailsState();
      toast.error('Neispravan ID klijenta.');
      return;
    }

    loadClientFromRoute(selectedClientId);
  }, [id, selectedClientId]);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <h1 className="text-3xl font-bold">Portal klijenata</h1>

      <Card>
        <CardHeader>
          <CardTitle>Pretraga i lista klijenata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Pretraga po imenu, prezimenu ili email-u"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          {listLoading ? (
            <p className="text-muted-foreground">Učitavanje klijenata...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Ime</th>
                    <th className="py-2 text-left">Prezime</th>
                    <th className="py-2 text-left">Email</th>
                    <th className="py-2 text-left">Telefon</th>
                    <th className="py-2 text-left">Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nema klijenata za prikaz.
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="border-b">
                        <td className="py-2">{client.firstName}</td>
                        <td className="py-2">{client.lastName}</td>
                        <td className="py-2">{client.email}</td>
                        <td className="py-2">{client.phoneNumber}</td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDetails(client.id)}
                          >
                            Detalji
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0 || listLoading}
            >
              Prethodna
            </Button>

            <span className="text-sm text-muted-foreground">
              Strana {page + 1} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={page >= totalPages - 1 || listLoading}
            >
              Sledeća
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Detalji klijenta</CardTitle>
            <Button variant="outline" size="sm" onClick={handleBackToList}>
              Zatvori detalje
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {detailsLoading && (
              <p className="text-sm text-muted-foreground">Učitavanje detalja...</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-first-name">Ime</Label>
                <Input
                  id="client-first-name"
                  value={editForm.firstName}
                  onChange={handleEditFieldChange('firstName')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-last-name">Prezime</Label>
                <Input
                  id="client-last-name"
                  value={editForm.lastName}
                  onChange={handleEditFieldChange('lastName')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  value={editForm.email}
                  onChange={handleEditFieldChange('email')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-phone">Telefon</Label>
                <Input
                  id="client-phone"
                  value={editForm.phoneNumber}
                  onChange={handleEditFieldChange('phoneNumber')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-address">Adresa</Label>
                <Input
                  id="client-address"
                  value={editForm.address}
                  onChange={handleEditFieldChange('address')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-date-of-birth">Datum rođenja</Label>
                <Input
                  id="client-date-of-birth"
                  value={editForm.dateOfBirth}
                  onChange={handleEditFieldChange('dateOfBirth')}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-gender">Pol</Label>
                <Input
                  id="client-gender"
                  value={editForm.gender}
                  onChange={handleEditFieldChange('gender')}
                  disabled={!isEditing || saving}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {!isEditing ? (
                <Button variant="outline" onClick={handleStartEdit} disabled={detailsLoading}>
                  Izmeni
                </Button>
              ) : (
                <>
                  <Button onClick={saveClient} disabled={saving}>
                    {saving ? 'Čuvanje...' : 'Sačuvaj'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                    Otkaži
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Računi klijenta</h3>

              {clientAccounts.length === 0 ? (
                <p className="text-muted-foreground">Nema računa za ovog klijenta.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Broj računa</th>
                        <th className="py-2 text-left">Tip</th>
                        <th className="py-2 text-left">Valuta</th>
                        <th className="py-2 text-left">Stanje</th>
                        <th className="py-2 text-left">Status</th>
                        <th className="py-2 text-left">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientAccounts.map((account) => (
                        <tr key={account.id} className="border-b">
                          <td className="py-2">{account.accountNumber}</td>
                          <td className="py-2">{account.accountType}</td>
                          <td className="py-2">{account.currency}</td>
                          <td className="py-2">{formatAmount(account.balance)}</td>
                          <td className="py-2">{account.status}</td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  account.accountType === 'POSLOVNI'
                                    ? `/accounts/${account.id}/business`
                                    : `/accounts/${account.id}`
                                )
                              }
                            >
                              Otvori
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}