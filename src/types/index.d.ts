export * from './dae'
import type { DaeConnectionRawMessage } from './dae'

export type BackendType = 'clash' | 'dae'

export type Backend = {
  type: BackendType
  protocol: string
  host: string
  port: string
  secondaryPath: string
  password: string
  username?: string
  uuid: string
  label?: string
  disableUpgradeCore?: boolean
  disableTunMode?: boolean
}

export type Config = {
  port: number
  'socks-port': number
  'redir-port': number
  'tproxy-port': number
  'mixed-port': number
  'allow-lan': boolean
  'bind-address': string
  mode: string
  'mode-list': string[]
  modes: string[]
  'log-level': string
  ipv6: boolean
  tun: {
    enable: boolean
    stack?: string
  }
}

export type History = {
  time: string
  delay: number
}[]

export type Proxy = {
  id?: string
  name: string
  type: string
  history: History
  extra: Record<
    string,
    {
      alive: boolean
      history: History
    }
  >
  all?: string[]
  udp?: boolean
  xudp?: boolean
  now: string
  fixed?: string
  icon: string
  hidden?: boolean
  selectable?: boolean
  testUrl?: string
  'dialer-proxy'?: string
  'provider-name'?: string
}

export type SubscriptionInfo = {
  Download?: number
  Upload?: number
  Total?: number
  Expire?: number
}

/** One node of a tailnet, as reported by the core for a Tailscale outbound. */
export type TailscalePeer = {
  id: string
  hostName: string
  dnsName: string
  os?: string
  ips: string[] | null
  tags?: string[]
  routes?: string[]
  relay?: string
  online: boolean
  self: boolean
  /** This peer is the exit node currently in use. */
  exitNode: boolean
  /** This peer may be selected as an exit node. */
  exitNodeOption: boolean
  /** RFC3339, only set while the node is offline. */
  lastSeen?: string
  rxBytes: number
  txBytes: number
}

export type TailscaleStatus = {
  /** ipn.State string, e.g. 'Running' or 'NeedsLogin'. */
  backendState: string
  self?: TailscalePeer
  /** Set while the node needs a login; opening it authorises the node. */
  authURL?: string
  /** What the outbound is configured to use; '' when none. */
  exitNode: string
  /** Whether traffic is actually leaving through an exit node. */
  exitNodeActive: boolean
  /** Administrative on/off switch, the equivalent of tailscale up/down. */
  wantRunning: boolean
  peers: TailscalePeer[]
}

export type ProxyProvider = {
  subscriptionInfo?: SubscriptionInfo
  id?: string
  name: string
  proxies: Proxy[]
  testUrl: string
  updatedAt: string
  vehicleType: string
}

export type Rule = {
  type: string
  payload: string
  proxy: string
  size: number
  uuid: string
  disabled?: boolean
  index: number
  extra?: {
    disabled: false
    hitAt: string
    hitCount: number
    missAt: string
    missCount: number
  }
}

export type RuleProvider = {
  behavior: string
  format: string
  name: string
  ruleCount: number
  type: string
  updatedAt: string
  vehicleType: string
}

export type ClashConnectionRawMessage = {
  id: string
  download: number
  upload: number
  chains: string[]
  rule: string
  rulePayload: string
  start: string | number
  metadata: {
    destinationGeoIP: string
    destinationIP: string
    destinationIPASN: string
    destinationPort: string
    dnsMode: string
    dscp: number
    host: string
    inboundIP: string
    inboundName: string
    inboundPort: string
    inboundUser: string
    network: string
    process: string
    processPath: string
    remoteDestination: string
    sniffHost: string
    sourceGeoIP: string
    sourceIP: string
    sourceIPASN: string
    sourcePort: string
    specialProxy: string
    specialRules: string
    type: string
    uid: number
    smartBlock: string
  }
}

export type ConnectionRawMessage = ClashConnectionRawMessage | DaeConnectionRawMessage

export type Connection = ConnectionRawMessage & {
  downloadSpeed: number
  uploadSpeed: number
}

export type Log = {
  type: LOG_LEVEL
  payload: string
}

export type LogWithSeq = Log & { seq: number; time: string }

export type DNSQuery = {
  AD: boolean
  CD: boolean
  RA: boolean
  RD: boolean
  TC: boolean
  status: number
  Question: {
    Name: string
    Qtype: number
    Qclass: number
  }[]
  Answer?: {
    TTL: number
    data: string
    name: string
    type: number
  }[]
}

export type SourceIPLabel = {
  key: string
  label: string
  id: string
  scope?: string[]
}

export interface NodeRank {
  Name: string
  Rank: string
  Weight: number
}

export type HonkStats = {
  outbounds: {
    name: string
    totalConns: number
    activeConns: number
    upload: number
    download: number
    errors: number
  }[]
}
