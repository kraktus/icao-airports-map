tmux new-session -s icao -d
tmux split-window -d
tmux split-window -d
tmux split-window -d
tmux send-keys -t icao.1 "pnpm dev" C-m
tmux send-keys -t icao.2 "pnpm typecheck" C-m
tmux send-keys -t icao.4 "pnpm watch-format" C-m
tmux attach-session -t icao