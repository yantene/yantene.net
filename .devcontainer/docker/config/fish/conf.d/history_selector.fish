if type -q sk
  function __history-selector
    set selected_command (history --null | sk --read0)

    test -z "$selected_command" && return

    commandline $selected_command
    commandline -f repaint
  end

  bind \cr __history-selector
end
