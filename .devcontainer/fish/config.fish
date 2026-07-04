# PNPM configuration for Fish shell
set -gx PNPM_HOME "$HOME/.local/share/pnpm"
if not string match -q -- $PNPM_HOME $PATH
  set -gx PATH "$PNPM_HOME" "$PNPM_HOME/bin" $PATH
end
