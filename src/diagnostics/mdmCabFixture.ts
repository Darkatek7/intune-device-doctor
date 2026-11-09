/**
 * Synthetisches MDM-Diagnosepaket `mdmlogs-*.cab` für das Fixture-ZIP, Tests und das Messskript.
 *
 * Ausschließlich fiktive Daten (Contoso, contoso.com, CONTOSO-PC042, Null-GUIDs). Die Dateinamen
 * folgen der Beschreibung in Microsoft Learn („Collect MDM logs“); der **Elementaufbau von
 * MDMDiagReport.xml ist frei erfunden**, denn Learn beschreibt ihn nicht (nur `Multivariant` mit
 * `Condition`). Der Parser wertet deshalb nur diese Bedingungen und die Elementnamen aus.
 */
import { buildCab, type BuildCabOptions, type CabFileInput } from './cabFixture';

/** Name des Pakets im Fixture-ZIP (Datum im Namen = Sammelzeitpunkt) */
export const FIXTURE_MDM_CAB_NAME = 'mdmlogs-20261014-125312.cab';

/** Annahme: Verzeichnis, in das das Paket gelegt wird (Learn nennt C:\Users\Public\Documents\MDMDiagnostics) */
export const FIXTURE_MDM_CAB_DIRECTORY = 'Users_Public_Documents_MDMDiagnostics';

/** `Condition`-Werte, die der Parser aus dem Fixture lesen soll (Reihenfolge wie im Dokument). */
export const FIXTURE_MULTIVARIANT_CONDITIONS = [
  'Pattern:.*Contoso.*',
  'Name=Lang Value=de',
  'Name=Architecture Value=Pattern:.*64.*',
];

export const FIXTURE_MDM_DIAG_REPORT_XML = `<?xml version="1.0" encoding="utf-8"?>
<MDMEnterpriseDiagnosticsReport>
  <DeviceInfo>
    <DeviceName>CONTOSO-PC042</DeviceName>
    <SerialNumber>CONTOSO-SN-000042</SerialNumber>
  </DeviceInfo>
  <Enrollment>
    <EnrollmentId>00000000-0000-0000-0000-000000000001</EnrollmentId>
    <UPN>user@contoso.com</UPN>
    <ManagementUrl>https://r.manage.contoso.com/ManagementServer/MDM.svc?token=geheim</ManagementUrl>
  </Enrollment>
  <Enrollment>
    <EnrollmentId>00000000-0000-0000-0000-000000000002</EnrollmentId>
  </Enrollment>
  <Certificate>
    <Issuer>Contoso Fixture CA</Issuer>
  </Certificate>
  <ProvisioningPackages>
    <Package Id="{00000000-0000-0000-0000-0000000000a1}" Name="Contoso Basis">
      <Multivariant Condition="Pattern:.*Contoso.*"/>
      <Multivariant>
        <Condition Name="Lang" Value="de"/>
      </Multivariant>
    </Package>
    <Package Id="{00000000-0000-0000-0000-0000000000a2}" Name="Contoso Architektur">
      <Multivariant>
        <Condition Name="Architecture" Value="Pattern:.*64.*"/>
      </Multivariant>
    </Package>
  </ProvisioningPackages>
</MDMEnterpriseDiagnosticsReport>
`;

/** Laut Learn enthält die Datei die Kommandozeilenargumente des Tools; die Schlüssel sind hier erfunden. */
export const FIXTURE_MDM_DIAG_METADATA_JSON = JSON.stringify({
  Tool: 'mdmdiagnosticstool',
  Arguments: ['-area', 'DeviceEnrollment;DeviceProvisioning;Autopilot'],
  RequestedBy: 'user@contoso.com',
  Nested: { ignoriert: true },
});

const encoder = new TextEncoder();

export interface MdmLogsCabOptions extends BuildCabOptions {
  /** Bytes eines MDM-Admin-Ereignisprotokolls (.evtx), das ins Paket gelegt wird */
  adminLogEvtx?: Uint8Array;
  /** Zusätzliche Dateien (z. B. große Daten für Messungen) */
  extraFiles?: CabFileInput[];
  /** MDMDiagReport.xml ersetzen (Standard: Fixture-Dokument) */
  reportXml?: Uint8Array;
}

/** Baut ein kleines MDM-Diagnosepaket (MSZIP) mit den von Learn beschriebenen Dateinamen. */
export function buildMdmLogsCab(options: MdmLogsCabOptions = {}): Uint8Array {
  const { adminLogEvtx, extraFiles, reportXml, ...cabOptions } = options;
  const files: CabFileInput[] = [
    { name: 'MDMDiagHtmlReport.html', data: encoder.encode('<html><body>Contoso</body></html>') },
    { name: 'MdmDiagLogMetadata.json', data: encoder.encode(FIXTURE_MDM_DIAG_METADATA_JSON) },
    { name: 'MDMDiagReport.xml', data: reportXml ?? encoder.encode(FIXTURE_MDM_DIAG_REPORT_XML) },
    {
      name: 'MdmDiagReport_RegistryDump.reg',
      data: encoder.encode('Windows Registry Editor Version 5.00\r\n'),
    },
    { name: 'MdmLogCollectorFootPrint.txt', data: encoder.encode('Collect: ok\r\n') },
  ];
  if (adminLogEvtx)
    files.push({
      name: 'microsoft-windows-devicemanagement-enterprise-diagnostics-provider-admin.evtx',
      data: adminLogEvtx,
    });
  if (extraFiles) files.push(...extraFiles);
  return buildCab(files, { compression: 'mszip', ...cabOptions });
}
