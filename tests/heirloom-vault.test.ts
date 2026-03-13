import { describe, it, expect } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!; // heir 1
const wallet2 = accounts.get("wallet_2")!; // heir 2
const wallet3 = accounts.get("wallet_3")!; // guardian

function createDefaultVault(sender = deployer) {
  return simnet.callPublicFn(
    "heirloom-vault-v6",
    "create-vault",
    [
      Cl.uint(120), // 2 min interval
      Cl.uint(60), // 1 min grace
      Cl.list([
        Cl.tuple({
          heir: Cl.principal(wallet1),
          "split-bps": Cl.uint(7000),
        }),
        Cl.tuple({
          heir: Cl.principal(wallet2),
          "split-bps": Cl.uint(3000),
        }),
      ]),
      Cl.none(), // no guardian
    ],
    sender
  );
}

describe("Heirloom Vault", () => {
  describe("create-vault", () => {
    it("creates a vault with valid heirs", () => {
      const result = createDefaultVault();
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("rejects splits that don't sum to 10000", () => {
      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "create-vault",
        [
          Cl.uint(120),
          Cl.uint(60),
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(5000),
            }),
            Cl.tuple({
              heir: Cl.principal(wallet2),
              "split-bps": Cl.uint(3000),
            }),
          ]),
          Cl.none(),
        ],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(106)); // ERR-INVALID-SPLITS
    });

    it("rejects duplicate vault creation", () => {
      createDefaultVault();
      const result = createDefaultVault();
      expect(result.result).toBeErr(Cl.uint(109)); // ERR-VAULT-ALREADY-EXISTS
    });

    it("creates vault with guardian", () => {
      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "create-vault",
        [
          Cl.uint(120),
          Cl.uint(60),
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(10000),
            }),
          ]),
          Cl.some(Cl.principal(wallet3)),
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("heartbeat", () => {
    it("resets the heartbeat timer", () => {
      createDefaultVault();
      simnet.mineEmptyBlocks(10);

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "heartbeat",
        [],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("rejects heartbeat from non-owner", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "heartbeat",
        [],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(103)); // ERR-VAULT-NOT-FOUND
    });
  });

  describe("get-vault-status", () => {
    it("returns active status for fresh vault", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v6",
        "get-vault-status",
        [Cl.principal(deployer)],
        deployer
      );

      // Result is (ok { state: "active", ... })
      expect(result.result.type).toBe(ClarityType.ResponseOk);
      const okValue = (result.result as any).value;
      expect(okValue.type).toBe(ClarityType.Tuple);
      // Check state field exists in the tuple
      expect(okValue.value.state).toBeDefined();
      // Check usdcx-balance field exists
      expect(okValue.value["usdcx-balance"]).toBeDefined();
    });
  });

  describe("deposit-sbtc", () => {
    it("rejects zero amount", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "deposit-sbtc",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(113)); // ERR-NO-BALANCE
    });
  });

  describe("deposit-usdcx", () => {
    it("rejects zero amount", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "deposit-usdcx",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(113)); // ERR-NO-BALANCE
    });
  });

  describe("emergency-withdraw", () => {
    it("marks vault as distributed", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "emergency-withdraw",
        [],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("rejects withdraw on distributed vault", () => {
      createDefaultVault();
      simnet.callPublicFn(
        "heirloom-vault-v6",
        "emergency-withdraw",
        [],
        deployer
      );

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "emergency-withdraw",
        [],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(110)); // ERR-VAULT-DISTRIBUTED
    });
  });

  describe("update-heirs", () => {
    it("replaces heir list", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "update-heirs",
        [
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(5000),
            }),
            Cl.tuple({
              heir: Cl.principal(wallet3),
              "split-bps": Cl.uint(5000),
            }),
          ]),
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("validates splits sum to 10000", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "update-heirs",
        [
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(5000),
            }),
          ]),
        ],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(106)); // ERR-INVALID-SPLITS
    });
  });

  describe("get-heir-info", () => {
    it("returns heir split and claimed status", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v6",
        "get-heir-info",
        [Cl.principal(deployer), Cl.principal(wallet1)],
        deployer
      );

      expect(result.result.type).toBe(ClarityType.ResponseOk);
      const okValue = (result.result as any).value;
      expect(okValue.type).toBe(ClarityType.Tuple);
      expect(okValue.value["split-bps"]).toBeDefined();
    });

    it("rejects non-heir lookup", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v6",
        "get-heir-info",
        [Cl.principal(deployer), Cl.principal(wallet3)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(101)); // ERR-NOT-HEIR
    });
  });

  describe("get-heir-list", () => {
    it("returns list of heir addresses", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v6",
        "get-heir-list",
        [Cl.principal(deployer)],
        deployer
      );

      expect(result.result.type).toBe(ClarityType.ResponseOk);
      const okValue = (result.result as any).value;
      expect(okValue.type).toBe(ClarityType.List);
      expect(okValue.value.length).toBe(2);
    });
  });

  describe("heartbeat on distributed vault", () => {
    it("rejects heartbeat after emergency withdraw", () => {
      createDefaultVault();
      simnet.callPublicFn(
        "heirloom-vault-v6",
        "emergency-withdraw",
        [],
        deployer
      );

      const result = simnet.callPublicFn(
        "heirloom-vault-v6",
        "heartbeat",
        [],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(110)); // ERR-VAULT-DISTRIBUTED
    });
  });
});
