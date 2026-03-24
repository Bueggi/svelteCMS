<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Card, CardHeader, CardTitle, CardContent } from "$lib/components/ui/card";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
    import { StatusBadge } from "$lib/components/ui/status-badge";
    import { FormSelect } from "$lib/components/ui/form-select";
    import { Trash2, Plus, Power, PowerOff, Percent } from "lucide-svelte";
    import { enhance } from '$app/forms';

    let { data, form } = $props();
    let rates = $derived(data.rates);

    let isCreating = $state(false);

    // ISO 3166-1 alpha-2 country list
    const COUNTRIES = [
        ['AD','Andorra'],['AE','Vereinigte Arabische Emirate'],['AG','Antigua und Barbuda'],
        ['AL','Albanien'],['AM','Armenien'],['AO','Angola'],['AR','Argentinien'],
        ['AT','Österreich'],['AU','Australien'],['AZ','Aserbaidschan'],
        ['BA','Bosnien und Herzegowina'],['BB','Barbados'],['BD','Bangladesch'],
        ['BE','Belgien'],['BF','Burkina Faso'],['BG','Bulgarien'],['BH','Bahrain'],
        ['BI','Burundi'],['BJ','Benin'],['BN','Brunei'],['BO','Bolivien'],
        ['BR','Brasilien'],['BS','Bahamas'],['BT','Bhutan'],['BW','Botswana'],
        ['BY','Weißrussland'],['BZ','Belize'],['CA','Kanada'],['CD','Kongo (Dem. Rep.)'],
        ['CF','Zentralafrikanische Republik'],['CG','Kongo'],['CH','Schweiz'],
        ['CI','Elfenbeinküste'],['CL','Chile'],['CM','Kamerun'],['CN','China'],
        ['CO','Kolumbien'],['CR','Costa Rica'],['CU','Kuba'],['CV','Kap Verde'],
        ['CY','Zypern'],['CZ','Tschechien'],['DE','Deutschland'],['DJ','Dschibuti'],
        ['DK','Dänemark'],['DM','Dominica'],['DO','Dominikanische Republik'],
        ['DZ','Algerien'],['EC','Ecuador'],['EE','Estland'],['EG','Ägypten'],
        ['ER','Eritrea'],['ES','Spanien'],['ET','Äthiopien'],['FI','Finnland'],
        ['FJ','Fidschi'],['FR','Frankreich'],['GA','Gabun'],['GB','Vereinigtes Königreich'],
        ['GD','Grenada'],['GE','Georgien'],['GH','Ghana'],['GM','Gambia'],
        ['GN','Guinea'],['GQ','Äquatorialguinea'],['GR','Griechenland'],['GT','Guatemala'],
        ['GW','Guinea-Bissau'],['GY','Guyana'],['HN','Honduras'],['HR','Kroatien'],
        ['HT','Haiti'],['HU','Ungarn'],['ID','Indonesien'],['IE','Irland'],
        ['IL','Israel'],['IN','Indien'],['IQ','Irak'],['IR','Iran'],
        ['IS','Island'],['IT','Italien'],['JM','Jamaika'],['JO','Jordanien'],
        ['JP','Japan'],['KE','Kenia'],['KG','Kirgisistan'],['KH','Kambodscha'],
        ['KI','Kiribati'],['KM','Komoren'],['KN','St. Kitts und Nevis'],['KP','Nordkorea'],
        ['KR','Südkorea'],['KW','Kuwait'],['KZ','Kasachstan'],['LA','Laos'],
        ['LB','Libanon'],['LC','St. Lucia'],['LI','Liechtenstein'],['LK','Sri Lanka'],
        ['LR','Liberia'],['LS','Lesotho'],['LT','Litauen'],['LU','Luxemburg'],
        ['LV','Lettland'],['LY','Libyen'],['MA','Marokko'],['MC','Monaco'],
        ['MD','Moldawien'],['ME','Montenegro'],['MG','Madagaskar'],['MH','Marshallinseln'],
        ['MK','Nordmazedonien'],['ML','Mali'],['MM','Myanmar'],['MN','Mongolei'],
        ['MR','Mauretanien'],['MT','Malta'],['MU','Mauritius'],['MV','Malediven'],
        ['MW','Malawi'],['MX','Mexiko'],['MY','Malaysia'],['MZ','Mosambik'],
        ['NA','Namibia'],['NE','Niger'],['NG','Nigeria'],['NI','Nicaragua'],
        ['NL','Niederlande'],['NO','Norwegen'],['NP','Nepal'],['NR','Nauru'],
        ['NZ','Neuseeland'],['OM','Oman'],['PA','Panama'],['PE','Peru'],
        ['PG','Papua-Neuguinea'],['PH','Philippinen'],['PK','Pakistan'],['PL','Polen'],
        ['PT','Portugal'],['PW','Palau'],['PY','Paraguay'],['QA','Katar'],
        ['RO','Rumänien'],['RS','Serbien'],['RU','Russland'],['RW','Ruanda'],
        ['SA','Saudi-Arabien'],['SB','Salomonen'],['SC','Seychellen'],['SD','Sudan'],
        ['SE','Schweden'],['SG','Singapur'],['SI','Slowenien'],['SK','Slowakei'],
        ['SL','Sierra Leone'],['SM','San Marino'],['SN','Senegal'],['SO','Somalia'],
        ['SR','Surinam'],['SS','Südsudan'],['ST','São Tomé und Príncipe'],
        ['SV','El Salvador'],['SY','Syrien'],['SZ','Eswatini'],['TD','Tschad'],
        ['TG','Togo'],['TH','Thailand'],['TJ','Tadschikistan'],['TL','Timor-Leste'],
        ['TM','Turkmenistan'],['TN','Tunesien'],['TO','Tonga'],['TR','Türkei'],
        ['TT','Trinidad und Tobago'],['TV','Tuvalu'],['TZ','Tansania'],['UA','Ukraine'],
        ['UG','Uganda'],['US','USA'],['UY','Uruguay'],['UZ','Usbekistan'],
        ['VA','Vatikanstadt'],['VC','St. Vincent und die Grenadinen'],['VE','Venezuela'],
        ['VN','Vietnam'],['VU','Vanuatu'],['WS','Samoa'],['YE','Jemen'],
        ['ZA','Südafrika'],['ZM','Sambia'],['ZW','Simbabwe'],
    ] as const;

    // Filter out countries already configured
    let configuredCodes = $derived(new Set(rates.map((r: any) => r.countryCode)));
    let availableCountries = $derived(COUNTRIES.filter(([code]) => !configuredCodes.has(code)));
</script>

<PageContainer variant="admin">
    <PageHeader title="Steuersätze" description="Länderspezifische Mehrwertsteuersätze für den Checkout">
        {#snippet actions()}
            <Button onclick={() => isCreating = !isCreating}>
                {#if isCreating}
                    Abbrechen
                {:else}
                    <Plus class="w-4 h-4 mr-2" /> Land hinzufügen
                {/if}
            </Button>
        {/snippet}
    </PageHeader>

    {#if isCreating}
        <Card class="bg-card/50 backdrop-blur border shadow-sm mb-6">
            <CardHeader>
                <CardTitle>Neuen Steuersatz anlegen</CardTitle>
            </CardHeader>
            <CardContent>
                {#if form?.message}
                    <div class="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                        {form.message}
                    </div>
                {/if}
                <form method="POST" action="?/createRate" use:enhance={() => {
                    return async ({ update, result }) => {
                        await update();
                        if (result.type === 'success') isCreating = false;
                    };
                }} class="flex flex-wrap items-end gap-4 max-w-2xl">
                    <div class="space-y-1.5 flex-1 min-w-[200px]">
                        <label for="countryCode" class="text-sm font-medium">Land</label>
                        <FormSelect id="countryCode" name="countryCode" required onchange={(e) => {
                            const sel = e.currentTarget;
                            const nameInput = sel.form?.elements.namedItem('countryName') as HTMLInputElement;
                            const opt = sel.options[sel.selectedIndex];
                            if (nameInput) nameInput.value = opt.dataset.name ?? '';
                        }}>
                            <option value="">— Land wählen —</option>
                            {#each availableCountries as [code, name]}
                                <option value={code} data-name={name}>{name} ({code})</option>
                            {/each}
                        </FormSelect>
                        <input type="hidden" name="countryName" />
                    </div>
                    <div class="space-y-1.5 w-32">
                        <label for="rate" class="text-sm font-medium">Rate (%)</label>
                        <Input id="rate" name="rate" type="number" min="0" max="100" placeholder="z.B. 19" required />
                    </div>
                    <Button type="submit">Speichern</Button>
                </form>
            </CardContent>
        </Card>
    {/if}

    <Card class="bg-card/50 backdrop-blur border shadow-sm">
        <CardContent class="p-0">
            {#if rates.length === 0}
                <div class="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <Percent class="w-8 h-8 opacity-40" />
                    <p class="text-sm">Noch keine Steuersätze konfiguriert.</p>
                    <p class="text-xs">Für Länder ohne Eintrag gilt der globale Steuersatz aus den Einstellungen.</p>
                </div>
            {:else}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Land</TableHead>
                            <TableHead>Kürzel</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead class="text-right">Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {#each rates as rate}
                            <TableRow>
                                <TableCell class="font-medium">{rate.countryName}</TableCell>
                                <TableCell class="font-mono text-muted-foreground">{rate.countryCode}</TableCell>
                                <TableCell>
                                    <form method="POST" action="?/updateRate" use:enhance class="flex items-center gap-2">
                                        <input type="hidden" name="id" value={rate.id} />
                                        <Input
                                            name="rate"
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={rate.rate}
                                            class="w-20 h-8 text-sm"
                                        />
                                        <span class="text-muted-foreground text-sm">%</span>
                                        <Button type="submit" variant="outline" size="sm" class="h-8 text-xs">Speichern</Button>
                                    </form>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={rate.isEnabled ? 'active' : 'inactive'} />
                                </TableCell>
                                <TableCell class="text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <form method="POST" action="?/toggleRate" use:enhance>
                                            <input type="hidden" name="id" value={rate.id} />
                                            <Button type="submit" variant="ghost" size="icon" class="h-8 w-8" title={rate.isEnabled ? 'Deaktivieren' : 'Aktivieren'}>
                                                {#if rate.isEnabled}
                                                    <PowerOff class="w-4 h-4 text-muted-foreground" />
                                                {:else}
                                                    <Power class="w-4 h-4 text-primary" />
                                                {/if}
                                            </Button>
                                        </form>
                                        <form method="POST" action="?/deleteRate" use:enhance>
                                            <input type="hidden" name="id" value={rate.id} />
                                            <Button type="submit" variant="ghost" size="icon" class="h-8 w-8 text-destructive hover:text-destructive" title="Löschen">
                                                <Trash2 class="w-4 h-4" />
                                            </Button>
                                        </form>
                                    </div>
                                </TableCell>
                            </TableRow>
                        {/each}
                    </TableBody>
                </Table>
            {/if}
        </CardContent>
    </Card>

    <p class="text-xs text-muted-foreground mt-4">
        Länder ohne eigenen Eintrag verwenden den globalen Steuersatz aus
        <a href="/admin/settings" class="underline">Einstellungen → Rechnungsstellung</a>.
        Deaktivierte Einträge gelten ebenfalls als "kein spezifischer Satz" und fallen auf den globalen Wert zurück.
    </p>
</PageContainer>
