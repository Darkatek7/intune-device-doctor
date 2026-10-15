/**
 * Synthetischer Intune-"Collect diagnostics"-Fixture (DiagLogs-ZIP) für Tests und die Demo.
 *
 * Ausschließlich fiktive Daten: Contoso, contoso.com, CONTOSO-PC042, Null-GUIDs.
 * Format und Encodings: docs/diaglogs-format.md. Browser- und Node-tauglich (keine Node-Imports).
 */
import { zipSync } from 'fflate';

export const FIXTURE_FILE_NAME = 'DiagLogs-CONTOSO-PC042-20261014T125356Z.zip';

const FIXTURE_MTIME = new Date('2026-10-14T12:53:56Z');
const CRLF = '\r\n';

const encoder = new TextEncoder();

/** UTF-8 ohne BOM. */
export function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

/** UTF-8 mit BOM (EF BB BF), z. B. IME-Logs. */
export function utf8WithBom(text: string): Uint8Array {
  const body = encoder.encode(text);
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}

/** UTF-16LE mit BOM (FF FE), z. B. .reg-Exporte. */
export function utf16leWithBom(text: string): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[2 + i * 2] = code & 0xff;
    out[3 + i * 2] = code >> 8;
  }
  return out;
}

const crlf = (text: string): string => text.replace(/\r?\n/g, CRLF);

// ---------------------------------------------------------------------------
// results.xml (ASCII, kein BOM)
// ---------------------------------------------------------------------------

const RESULTS_XML = crlf(String.raw`<?xml version="1.0" encoding="utf-8"?>
<Collection HRESULT="0">
  <ID>00000000-0000-0000-0000-000000000000</ID>
  <SasUrl>SasUrlPlaceHolder</SasUrl>
  <RegistryKey HRESULT="-2147024893">HKLM\Software\Microsoft\Enrollments</RegistryKey>
  <RegistryKey HRESULT="-2147024893">HKLM\Software\Microsoft\IntuneManagementExtension</RegistryKey>
  <RegistryKey HRESULT="-2147024895">HKLM\SYSTEM\Setup\SetupDiag\Results</RegistryKey>
  <Command HRESULT="0">%windir%\system32\Dsregcmd.exe /status</Command>
  <Events HRESULT="0">System</Events>
  <FoldersFiles HRESULT="0">%ProgramData%\Microsoft\IntuneManagementExtension\Logs\*.*</FoldersFiles>
  <FoldersFiles HRESULT="-2147024893">%ProgramData%\Microsoft\EPMAgent\Logs\*.*</FoldersFiles>
  <ClientTimeoutInSeconds>3600</ClientTimeoutInSeconds>
  <OutputFileFormat>flattened</OutputFileFormat>
</Collection>
`);

// ---------------------------------------------------------------------------
// (1) Enrollments-.reg (UTF-16LE mit BOM)
// ---------------------------------------------------------------------------

const ENROLLMENTS_REG = crlf(String.raw`Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\Software\Microsoft\Enrollments\00000000-0000-0000-0000-00000000000A]
"EnrollmentState"=dword:00000001
"EnrollmentType"=dword:00000006
"ProviderID"="MS DM Server"
"UPN"="user@contoso.com"
"AADTenantID"="00000000-0000-0000-0000-000000000000"
"DiscoveryServiceFullURL"="https://enrollment.contoso.invalid/\"demo\""
"Flags"=hex:01,00,00,00

[HKEY_LOCAL_MACHINE\Software\Microsoft\Enrollments\00000000-0000-0000-0000-00000000000A\FirstSync]
"IsSyncDone"=dword:00000001

[HKEY_LOCAL_MACHINE\Software\Microsoft\Enrollments\00000000-0000-0000-0000-00000000000A\Push]
"ChannelURI"="https://push.contoso.invalid/channel/DEMO-CHANNEL-URI"

[HKEY_LOCAL_MACHINE\Software\Microsoft\Enrollments\00000000-0000-0000-0000-00000000000B]
"EnrollmentState"=dword:00000001
"EnrollmentType"=dword:00000000
"ProviderID"="WMI_Bridge_SCCM_Server"
`);

// ---------------------------------------------------------------------------
// (2) IntuneManagementExtension-.reg (UTF-16LE mit BOM)
// ---------------------------------------------------------------------------

const IME_REG = crlf(String.raw`Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\IntuneManagementExtension\Win32Apps\00000000-0000-0000-0000-000000000000]

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\IntuneManagementExtension\Win32Apps\00000000-0000-0000-0000-000000000000\00000000-0000-0000-0000-0000000000A1_1\OperationalState]
"Status"="Installed"
"ErrorCode"="0"
"ApplicabilityCode"="0"
"RebootStatus"="0"

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\IntuneManagementExtension\Win32Apps\00000000-0000-0000-0000-000000000000\00000000-0000-0000-0000-0000000000A2_1\OperationalState]
"Status"="Failed"
"ErrorCode"="-2147023294"
"ApplicabilityCode"="0"
"RebootStatus"="0"

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\IntuneManagementExtension\Win32Apps\00000000-0000-0000-0000-000000000000\00000000-0000-0000-0000-0000000000A3_1\OperationalState]
"Status"="NotApplicable"
"ErrorCode"="0"
"ApplicabilityCode"="0"
"RebootStatus"="0"
`);

// ---------------------------------------------------------------------------
// (3) dsregcmd /status (UTF-8 ohne BOM)
// ---------------------------------------------------------------------------

const DSREG_FRAME = `+${'-'.repeat(70)}+`;

/** Rechtsbündiger Key, Doppelpunkt, Wert – wie dsregcmd. */
const kvLine = (key: string, value: string): string => `${key.padStart(30)} : ${value}`;

function dsregSection(title: string, lines: string[]): string[] {
  return [DSREG_FRAME, `|${` ${title}`.padEnd(70)}|`, DSREG_FRAME, '', ...lines, ''];
}

const DSREGCMD_TEXT =
  [
    ...dsregSection('Device State', [
      kvLine('AzureAdJoined', 'YES'),
      kvLine('EnterpriseJoined', 'NO'),
      kvLine('DomainJoined', 'NO'),
      kvLine('Device Name', 'CONTOSO-PC042'),
    ]),
    ...dsregSection('Device Details', [
      kvLine('DeviceId', '00000000-0000-0000-0000-000000000042'),
      kvLine('Thumbprint', '0000000000000000000000000000000000000000'),
      kvLine('KeyContainerId', '00000000-0000-0000-0000-000000000000'),
      kvLine('KeyProvider', 'Microsoft Platform Crypto Provider'),
      kvLine('TpmProtected', 'YES'),
      kvLine('DeviceAuthStatus', 'SUCCESS'),
    ]),
    ...dsregSection('Tenant Details', [
      kvLine('TenantName', 'Contoso'),
      kvLine('TenantId', '00000000-0000-0000-0000-000000000000'),
      kvLine('MdmUrl', 'https://enrollment.manage.microsoft.com/enrollmentserver/discovery.svc'),
    ]),
    ...dsregSection('User State', [
      kvLine('NgcSet', 'YES'),
      kvLine('WorkplaceJoined', 'NO'),
      kvLine('WamDefaultSet', 'ERROR (0x80070520)'),
    ]),
    ...dsregSection('SSO State', [
      kvLine('AzureAdPrt', 'NO'),
      kvLine('AzureAdPrtAuthority', ''),
      kvLine('EnterprisePrt', 'NO'),
      '',
      kvLine('AcquirePrtDiagnostics', 'PRESENT'),
      kvLine('Previous Prt Attempt', '2026-10-12 08:00:00.000 UTC'),
      kvLine('Attempt Status', '0xc000023c'),
      kvLine('User Identity', 'user@contoso.com'),
      kvLine('Credential Type', 'NGC'),
      kvLine('Correlation ID', '00000000-0000-0000-0000-000000000000'),
      kvLine(
        'Endpoint URI',
        'https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/oauth2/token/',
      ),
      kvLine('HTTP Method', 'POST'),
      kvLine('HTTP Error', '0x80072ee7'),
      kvLine('HTTP status', '0'),
    ]),
    ...dsregSection('Diagnostic Data', [
      kvLine('AadRecoveryEnabled', 'NO'),
      kvLine('KeySignTest', 'PASSED'),
    ]),
  ].join(CRLF) + CRLF;

// ---------------------------------------------------------------------------
// (4) IME-Log im CMTrace-Format (UTF-8 mit BOM)
// ---------------------------------------------------------------------------

interface CmTraceLine {
  time: string;
  type: 1 | 2 | 3;
  thread: number;
  message: string;
}

const IME_LOG_DATE = '10-14-2026';

const IME_LOG_LINES: CmTraceLine[] = [
  {
    time: '12:50:11.1000001',
    type: 1,
    thread: 4,
    message: 'Service start requested by the Service Control Manager',
  },
  {
    time: '12:50:45.2233445',
    type: 3,
    thread: 7,
    message: 'LogonUser failed with error code : 1008',
  },
  {
    time: '12:51:03.1234567',
    type: 2,
    thread: 4,
    message: 'DNS detection: WinHttpGetProxyForUrl call failed because of error 12180',
  },
  {
    time: '12:51:20.5556667',
    type: 3,
    thread: 9,
    message: `AAD User check is failed, exception is System.ComponentModel.Win32Exception (0x80004005): Demo${CRLF}   at Contoso.Demo.Stack()`,
  },
  {
    time: '12:52:08.0001111',
    type: 3,
    thread: 4,
    message: 'Powershell exit code is 1',
  },
  {
    time: '12:52:40.7770001',
    type: 1,
    thread: 4,
    message: 'Policy evaluation completed, 3 Win32 apps checked',
  },
];

const IME_LOG_TEXT = IME_LOG_LINES.map(
  (line) =>
    `<![LOG[${line.message}]LOG]!><time="${line.time}" date="${IME_LOG_DATE}" component="IntuneManagementExtension" context="" type="${line.type}" thread="${line.thread}" file="">${CRLF}`,
).join('');

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

/** Dummy-Binär: "ElfFile\0" + 120 Nullbytes (128 Byte). Wird im MVP nicht ausgewertet. */
function buildEvtxDummy(): Uint8Array {
  const bytes = new Uint8Array(128);
  bytes.set(utf8('ElfFile'), 0);
  return bytes;
}

/** Pfad im ZIP → Bytes. Verzeichniseinträge enden auf '/' und haben 0 Byte. */
export function buildFixtureEntries(): Record<string, Uint8Array> {
  return {
    'results.xml': utf8(RESULTS_XML),
    '(1) RegistryKey HKLM_Software_Microsoft_Enrollments export.reg':
      utf16leWithBom(ENROLLMENTS_REG),
    '(2) RegistryKey HKLM_Software_Microsoft_IntuneManagementExtension export.reg':
      utf16leWithBom(IME_REG),
    '(3) Command windir_system32_Dsregcmd_exe_status output.log': utf8(DSREGCMD_TEXT),
    '(4) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/': new Uint8Array(0),
    '(4) FoldersFiles ProgramData_Microsoft_IntuneManagementExtension_Logs/IntuneManagementExtension.log':
      utf8WithBom(IME_LOG_TEXT),
    '(5) No Results - Error [0x80070001] RegistryKey HKLM_SYSTEM_Setup_SetupDiag_Results':
      new Uint8Array(0),
    '(6) No Results - Error [0x80070003] FoldersFiles ProgramData_Microsoft_EPMAgent_Logs':
      new Uint8Array(0),
    '(7) Events System Events.evtx': buildEvtxDummy(),
  };
}

/** Komplettes DiagLogs-ZIP (deterministisch: feste mtime, gleiche Eingaben → gleiche Bytes). */
export function buildFixtureZip(): Uint8Array {
  return zipSync(buildFixtureEntries(), { mtime: FIXTURE_MTIME });
}
