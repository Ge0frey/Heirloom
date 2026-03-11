;; Mock sBTC token for local development and testing
;; Implements SIP-010 fungible token trait

(define-fungible-token sbtc)

(define-constant ERR-NOT-AUTHORIZED (err u1))
(define-constant ERR-INSUFFICIENT-BALANCE (err u2))

(define-public (transfer
    (amount uint)
    (sender principal)
    (recipient principal)
    (memo (optional (buff 34)))
  )
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (try! (ft-transfer? sbtc amount sender recipient))
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "sBTC")
)

(define-read-only (get-symbol)
  (ok "sBTC")
)

(define-read-only (get-decimals)
  (ok u8)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance sbtc account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply sbtc))
)

(define-read-only (get-token-uri)
  (ok none)
)

;; Mint function for testing
(define-public (mint
    (amount uint)
    (recipient principal)
  )
  (ft-mint? sbtc amount recipient)
)
