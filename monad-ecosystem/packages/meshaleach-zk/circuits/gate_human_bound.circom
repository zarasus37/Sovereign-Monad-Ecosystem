pragma circom 2.0.0;

// Meshaleach Phase 2 SNARK: prove gate_passed ∧ human_bound without revealing salt.
// Private inputs: gate_passed, human_bound, salt
// Public outputs: out_gate, out_human, commit
// Constraints force both flags to 1 and bind salt into commit.

template GateHumanBound() {
    signal input gate_passed;
    signal input human_bound;
    signal input salt;

    signal output out_gate;
    signal output out_human;
    signal output commit;

    // boolean constraints
    gate_passed * (gate_passed - 1) === 0;
    human_bound * (human_bound - 1) === 0;

    // force both true (public outputs will be 1)
    gate_passed === 1;
    human_bound === 1;

    out_gate <== gate_passed;
    out_human <== human_bound;

    // bind salt: commit = salt^2 + gate + 2*human + 1
    signal salt2;
    salt2 <== salt * salt;
    commit <== salt2 + gate_passed + 2 * human_bound + 1;
}

component main = GateHumanBound();
