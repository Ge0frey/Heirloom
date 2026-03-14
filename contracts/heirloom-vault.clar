;; heirloom-vault.clar
;; Heirloom: A Bitcoin-heartbeat inheritance vault
;; If your Bitcoin goes silent, your plan speaks.

;; ============================================
;; CONSTANTS
;; ============================================

;; Error codes
(define-constant ERR-NOT-HEIR (err u101))
(define-constant ERR-NOT-GUARDIAN (err u102))
(define-constant ERR-VAULT-NOT-FOUND (err u103))
(define-constant ERR-VAULT-NOT-CLAIMABLE (err u104))
(define-constant ERR-ALREADY-CLAIMED (err u105))
(define-constant ERR-INVALID-SPLITS (err u106))
(define-constant ERR-VAULT-ALREADY-EXISTS (err u109))
(define-constant ERR-VAULT-DISTRIBUTED (err u110))
(define-constant ERR-GUARDIAN-PAUSE-USED (err u111))
(define-constant ERR-NOT-IN-GRACE (err u112))
(define-constant ERR-NO-BALANCE (err u113))

;; Token references
(define-constant SBTC-CONTRACT 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet)
(define-constant USDCX-CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx)

;; Basis points (10000 = 100%)
(define-constant BASIS-POINTS u10000)

;; Guardian pause bonus (additional seconds, 30 days = 2592000)
(define-constant GUARDIAN-PAUSE-BONUS u2592000)

;; ============================================
;; DATA STORAGE
;; ============================================

;; Primary vault data - one vault per owner
(define-map vaults
  principal
  {
    heartbeat-interval: uint,
    grace-period: uint,
    last-heartbeat: uint,
    sbtc-balance: uint,
    usdcx-balance: uint,
    guardian: (optional principal),
    guardian-pause-used: bool,
    is-distributed: bool,
    created-at: uint,
    heir-count: uint,
    claims-count: uint,
  }
)

;; Heir splits - maps (owner, heir) to basis points
(define-map heirs
  {
    owner: principal,
    heir: principal,
  }
  { split-bps: uint }
)

;; Ordered heir list for iteration
(define-map heir-list
  principal
  (list 10 principal)
)

;; Claim tracking
(define-map heir-claimed
  {
    owner: principal,
    heir: principal,
  }
  bool
)

;; ============================================
;; PRIVATE HELPERS
;; ============================================

;; Get the effective deadline (interval + grace + any guardian bonus)
(define-private (get-effective-deadline (vault {
  heartbeat-interval: uint,
  grace-period: uint,
  last-heartbeat: uint,
  sbtc-balance: uint,
  usdcx-balance: uint,
  guardian: (optional principal),
  guardian-pause-used: bool,
  is-distributed: bool,
  created-at: uint,
  heir-count: uint,
  claims-count: uint,
}))
  (let (
      (base-deadline (+ (get heartbeat-interval vault) (get grace-period vault)))
      (pause-bonus (if (get guardian-pause-used vault)
        GUARDIAN-PAUSE-BONUS
        u0
      ))
    )
    (+ base-deadline pause-bonus)
  )
)

;; Compute elapsed time since last heartbeat
(define-private (get-elapsed (vault {
  heartbeat-interval: uint,
  grace-period: uint,
  last-heartbeat: uint,
  sbtc-balance: uint,
  usdcx-balance: uint,
  guardian: (optional principal),
  guardian-pause-used: bool,
  is-distributed: bool,
  created-at: uint,
  heir-count: uint,
  claims-count: uint,
}))
  (- stacks-block-time (get last-heartbeat vault))
)

;; Validate heir splits sum to exactly 10000 basis points
(define-private (sum-splits
    (entry {
      heir: principal,
      split-bps: uint,
    })
    (acc uint)
  )
  (+ acc (get split-bps entry))
)

;; Helper to extract heir address from tuple
(define-private (get-heir-address (entry {
  heir: principal,
  split-bps: uint,
}))
  (get heir entry)
)

;; Helper to store a single heir's split (uses tx-sender as owner)
(define-private (store-heir-split (entry {
  heir: principal,
  split-bps: uint,
}))
  (map-set heirs {
    owner: tx-sender,
    heir: (get heir entry),
  } { split-bps: (get split-bps entry) }
  )
)

;; Helper to reset a single heir's claim status (used when re-creating vault after distribution)
(define-private (reset-heir-claim (entry {
  heir: principal,
  split-bps: uint,
}))
  (map-set heir-claimed {
    owner: tx-sender,
    heir: (get heir entry),
  } false)
)

;; ============================================
;; PUBLIC FUNCTIONS
;; ============================================

;; Create a new vault
(define-public (create-vault
    (heartbeat-interval uint)
    (grace-period uint)
    (heirs-data (list 10 {
      heir: principal,
      split-bps: uint,
    }))
    (guardian (optional principal))
  )
  (let (
      (total-splits (fold sum-splits heirs-data u0))
      (heir-addresses (map get-heir-address heirs-data))
    )
    ;; Allow creation if no vault exists, or existing vault is fully distributed
    (match (map-get? vaults tx-sender)
      existing-vault (asserts! (get is-distributed existing-vault) ERR-VAULT-ALREADY-EXISTS)
      true
    )
    ;; Validate splits sum to 100%
    (asserts! (is-eq total-splits BASIS-POINTS) ERR-INVALID-SPLITS)
    ;; Validate at least one heir
    (asserts! (> (len heirs-data) u0) ERR-INVALID-SPLITS)

    ;; Store vault
    (map-set vaults tx-sender {
      heartbeat-interval: heartbeat-interval,
      grace-period: grace-period,
      last-heartbeat: stacks-block-time,
      sbtc-balance: u0,
      usdcx-balance: u0,
      guardian: guardian,
      guardian-pause-used: false,
      is-distributed: false,
      created-at: stacks-block-time,
      heir-count: (len heirs-data),
      claims-count: u0,
    })

    ;; Store heir list
    (map-set heir-list tx-sender heir-addresses)

    ;; Store individual heir splits
    (map store-heir-split heirs-data)

    ;; Reset claim status for new heirs (needed when re-creating after distribution)
    (map reset-heir-claim heirs-data)

    (ok true)
  )
)

;; Deposit sBTC into vault
(define-public (deposit-sbtc (amount uint))
  (let ((vault (unwrap! (map-get? vaults tx-sender) ERR-VAULT-NOT-FOUND)))
    (asserts! (not (get is-distributed vault)) ERR-VAULT-DISTRIBUTED)
    (asserts! (> amount u0) ERR-NO-BALANCE)

    ;; Transfer sBTC from sender to this contract (Clarity 4: restrict-assets? with with-ft)
    (try! (restrict-assets? tx-sender
      ((with-ft 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet "test-sbtc" amount))
      (try! (contract-call? 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet transfer amount tx-sender current-contract none))
    ))

    ;; Update balance
    (map-set vaults tx-sender
      (merge vault { sbtc-balance: (+ (get sbtc-balance vault) amount) })
    )

    (ok true)
  )
)

;; Deposit USDCx into vault
(define-public (deposit-usdcx (amount uint))
  (let ((vault (unwrap! (map-get? vaults tx-sender) ERR-VAULT-NOT-FOUND)))
    (asserts! (not (get is-distributed vault)) ERR-VAULT-DISTRIBUTED)
    (asserts! (> amount u0) ERR-NO-BALANCE)

    ;; Transfer USDCx from sender to this contract (Clarity 4: restrict-assets? with with-ft)
    (try! (restrict-assets? tx-sender
      ((with-ft 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx "usdcx-token" amount))
      (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx transfer amount tx-sender current-contract none))
    ))

    ;; Update balance
    (map-set vaults tx-sender
      (merge vault { usdcx-balance: (+ (get usdcx-balance vault) amount) })
    )

    (ok true)
  )
)

;; Send heartbeat - proof of life
(define-public (heartbeat)
  (let ((vault (unwrap! (map-get? vaults tx-sender) ERR-VAULT-NOT-FOUND)))
    (asserts! (not (get is-distributed vault)) ERR-VAULT-DISTRIBUTED)

    ;; Reset the heartbeat timer
    (map-set vaults tx-sender (merge vault { last-heartbeat: stacks-block-time }))

    (ok true)
  )
)

;; Heir claims their share
(define-public (claim (vault-owner principal))
  (let (
      (claimer tx-sender)
      (vault (unwrap! (map-get? vaults vault-owner) ERR-VAULT-NOT-FOUND))
      (elapsed (get-elapsed vault))
      (deadline (get-effective-deadline vault))
      (heir-data (unwrap!
        (map-get? heirs {
          owner: vault-owner,
          heir: claimer,
        })
        ERR-NOT-HEIR
      ))
      (already-claimed (default-to false
        (map-get? heir-claimed {
          owner: vault-owner,
          heir: claimer,
        })
      ))
      (split-bps (get split-bps heir-data))
      (sbtc-share (/ (* (get sbtc-balance vault) split-bps) BASIS-POINTS))
      (usdcx-share (/ (* (get usdcx-balance vault) split-bps) BASIS-POINTS))
    )
    ;; Validate vault is claimable
    (asserts! (not (get is-distributed vault)) ERR-VAULT-DISTRIBUTED)
    (asserts! (>= elapsed deadline) ERR-VAULT-NOT-CLAIMABLE)
    (asserts! (not already-claimed) ERR-ALREADY-CLAIMED)

    ;; Transfer sBTC share to heir
    (if (> sbtc-share u0)
      (try! (as-contract? ((with-ft 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet "test-sbtc" sbtc-share))
        (try! (contract-call? 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet transfer sbtc-share tx-sender claimer none))
      ))
      true
    )

    ;; Transfer USDCx share to heir
    (if (> usdcx-share u0)
      (try! (as-contract? ((with-ft 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx "usdcx-token" usdcx-share))
        (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx transfer usdcx-share tx-sender claimer none))
      ))
      true
    )

    ;; Mark as claimed
    (map-set heir-claimed {
      owner: vault-owner,
      heir: claimer,
    }
      true
    )

    ;; Increment claims count and auto-distribute when all heirs have claimed
    (let (
        (new-claims-count (+ (get claims-count vault) u1))
        (all-claimed (is-eq new-claims-count (get heir-count vault)))
      )
      (map-set vaults vault-owner
        (merge vault {
          sbtc-balance: (- (get sbtc-balance vault) sbtc-share),
          usdcx-balance: (- (get usdcx-balance vault) usdcx-share),
          claims-count: new-claims-count,
          is-distributed: all-claimed,
        })
      )
    )

    (ok true)
  )
)

;; Emergency withdraw - owner reclaims everything
(define-public (emergency-withdraw)
  (let (
      (owner tx-sender)
      (vault (unwrap! (map-get? vaults tx-sender) ERR-VAULT-NOT-FOUND))
      (sbtc-bal (get sbtc-balance vault))
      (usdcx-bal (get usdcx-balance vault))
    )
    (asserts! (not (get is-distributed vault)) ERR-VAULT-DISTRIBUTED)

    ;; Return all sBTC to owner
    (if (> sbtc-bal u0)
      (try! (as-contract? ((with-ft 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet "test-sbtc" sbtc-bal))
        (try! (contract-call? 'ST126WM9ZYGYSNFM2YDV11MS0XMCJ91Q20HPNZY4T.test-sbtc-faucet transfer sbtc-bal tx-sender owner none))
      ))
      true
    )

    ;; Return all USDCx to owner
    (if (> usdcx-bal u0)
      (try! (as-contract? ((with-ft 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx "usdcx-token" usdcx-bal))
        (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx transfer usdcx-bal tx-sender owner none))
      ))
      true
    )

    ;; Mark as distributed (effectively cancelled)
    (map-set vaults owner
      (merge vault {
        sbtc-balance: u0,
        usdcx-balance: u0,
        is-distributed: true,
      })
    )

    (ok true)
  )
)

;; Guardian pause - extends grace period
(define-public (guardian-pause (vault-owner principal))
  (let (
      (vault (unwrap! (map-get? vaults vault-owner) ERR-VAULT-NOT-FOUND))
      (elapsed (get-elapsed vault))
      (interval (get heartbeat-interval vault))
      (total (+ interval (get grace-period vault)))
    )
    ;; Must be the guardian
    (asserts! (is-eq (some tx-sender) (get guardian vault)) ERR-NOT-GUARDIAN)
    ;; Must be in grace period (past interval, before full deadline)
    (asserts! (>= elapsed interval) ERR-NOT-IN-GRACE)
    (asserts! (< elapsed total) ERR-VAULT-NOT-CLAIMABLE)
    ;; Guardian can only pause once
    (asserts! (not (get guardian-pause-used vault)) ERR-GUARDIAN-PAUSE-USED)

    (map-set vaults vault-owner (merge vault { guardian-pause-used: true }))

    (ok true)
  )
)

;; Update heirs (owner only, vault must not be distributed)
(define-public (update-heirs (new-heirs (list 10 {
  heir: principal,
  split-bps: uint,
})))
  (let (
      (vault (unwrap! (map-get? vaults tx-sender) ERR-VAULT-NOT-FOUND))
      (total-splits (fold sum-splits new-heirs u0))
      (new-addresses (map get-heir-address new-heirs))
    )
    (asserts! (not (get is-distributed vault)) ERR-VAULT-DISTRIBUTED)
    (asserts! (is-eq total-splits BASIS-POINTS) ERR-INVALID-SPLITS)
    (asserts! (> (len new-heirs) u0) ERR-INVALID-SPLITS)

    ;; Update heir list
    (map-set heir-list tx-sender new-addresses)

    ;; Update individual splits
    (map store-heir-split new-heirs)

    ;; Update heir count
    (map-set vaults tx-sender (merge vault { heir-count: (len new-heirs) }))

    (ok true)
  )
)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

;; Get full vault status with computed state
(define-read-only (get-vault-status (owner principal))
  (let (
      (vault (unwrap! (map-get? vaults owner) ERR-VAULT-NOT-FOUND))
      (elapsed (- stacks-block-time (get last-heartbeat vault)))
      (interval (get heartbeat-interval vault))
      (deadline (get-effective-deadline vault))
    )
    (ok {
      state: (if (get is-distributed vault)
        "distributed"
        (if (>= elapsed deadline)
          "claimable"
          (if (>= elapsed interval)
            "grace"
            "active"
          )
        )
      ),
      sbtc-balance: (get sbtc-balance vault),
      usdcx-balance: (get usdcx-balance vault),
      last-heartbeat: (get last-heartbeat vault),
      heartbeat-interval: interval,
      grace-period: (get grace-period vault),
      elapsed-seconds: elapsed,
      seconds-until-grace: (if (>= elapsed interval)
        u0
        (- interval elapsed)
      ),
      seconds-until-claimable: (if (>= elapsed deadline)
        u0
        (- deadline elapsed)
      ),
      heir-count: (get heir-count vault),
      claims-count: (get claims-count vault),
      guardian: (get guardian vault),
      guardian-pause-used: (get guardian-pause-used vault),
      is-distributed: (get is-distributed vault),
      created-at: (get created-at vault),
    })
  )
)

;; Get heir info
(define-read-only (get-heir-info
    (owner principal)
    (heir principal)
  )
  (let (
      (heir-data (unwrap!
        (map-get? heirs {
          owner: owner,
          heir: heir,
        })
        ERR-NOT-HEIR
      ))
      (claimed (default-to false
        (map-get? heir-claimed {
          owner: owner,
          heir: heir,
        })
      ))
    )
    (ok {
      split-bps: (get split-bps heir-data),
      has-claimed: claimed,
    })
  )
)

;; Get heir list
(define-read-only (get-heir-list (owner principal))
  (ok (default-to (list) (map-get? heir-list owner)))
)
