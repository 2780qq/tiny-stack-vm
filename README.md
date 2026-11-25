# tiny-stack-vm

An exact interpreter of make.fun's tiny stack ISA v1, written for the
"Build a tiny stack virtual machine" bounty.

`main.ts` reads every instance under `/input/<id>/`, runs its bytecode on the
input bytes, and writes `/output/<id>/stdout.bin` and `/output/<id>/exit.txt`.

It implements the ISA as specified, including the rules most implementations
get wrong: wrapping 32-bit multiplication, `-2147483648 / -1` and
`-2147483648 % -1`, the sign of a remainder, the unsigned family (DIVU, MODU,
LTU) on negative values, shift counts masked to five bits, PUSH8's sign
extension, EXIT's low byte, falling off the end of the program, IN past the
end of the input, and all ten traps — each with its own code, keeping the
output written before the trap.

Run it locally:

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Licence

MIT
