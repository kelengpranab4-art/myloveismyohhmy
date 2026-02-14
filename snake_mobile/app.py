import os
import random
from collections import deque

from kivy.app import App
from kivy.animation import Animation
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.metrics import dp
from kivy.storage.jsonstore import JsonStore
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.widget import Widget
from kivy.graphics import Color, Rectangle, RoundedRectangle, Line, Ellipse

# Mobile-first window sizing for desktop testing
Window.minimum_width = 360
Window.minimum_height = 640

LEVELS = [
    {"name": "Bloom", "speed": 0.19, "target": 90},
    {"name": "Pulse", "speed": 0.17, "target": 200},
    {"name": "Surge", "speed": 0.15, "target": 340},
    {"name": "Vortex", "speed": 0.13, "target": 520},
    {"name": "Zenith", "speed": 0.11, "target": 750},
]
MIN_SPEED = 0.08

COLORS = {
    "bg_top": (0.08, 0.09, 0.12, 1),
    "bg_bottom": (0.04, 0.05, 0.08, 1),
    "board": (0.09, 0.11, 0.16, 1),
    "board_border": (0.20, 0.27, 0.35, 0.9),
    "grid": (0.18, 0.22, 0.30, 0.18),
    "snake": (0.25, 0.92, 0.72, 1),
    "snake_head": (0.38, 0.98, 0.82, 1),
    "food": (1.0, 0.5, 0.2, 1),
    "food_boost": (0.98, 0.83, 0.25, 1),
    "food_slow": (0.45, 0.62, 1.0, 1),
    "obstacle": (0.62, 0.35, 0.85, 1),
    "accent": (1.0, 0.6, 0.3, 1),
}


def build_obstacles(level, cols, rows):
    obstacles = set()
    if level >= 2:
        cx, cy = cols // 2, rows // 2
        for x in range(cx - 2, cx + 2):
            for y in range(cy - 1, cy + 1):
                obstacles.add((x, y))
    if level >= 3:
        for y in range(3, rows - 3):
            obstacles.add((cols // 3, y))
            obstacles.add((cols * 2 // 3, y))
    if level >= 4:
        for x in range(3, cols - 3):
            obstacles.add((x, rows // 3))
            obstacles.add((x, rows * 2 // 3,))
    if level >= 5:
        for x in range(2, 5):
            for y in range(2, 5):
                obstacles.add((x, y))
                obstacles.add((cols - 1 - x, rows - 1 - y))
    return obstacles


class GameBoard(Widget):
    def __init__(self, on_score, on_level, on_status, on_high_score, **kwargs):
        super().__init__(**kwargs)
        self.on_score = on_score
        self.on_level = on_level
        self.on_status = on_status
        self.on_high_score = on_high_score

        self.cols = 18
        self.rows = 28
        self.cell = 20
        self.origin_x = 0
        self.origin_y = 0
        self.board_w = 0
        self.board_h = 0

        self.direction = (1, 0)
        self.next_direction = (1, 0)
        self.snake = deque()
        self.food = None
        self.food_type = "normal"
        self.obstacles = set()
        self.score = 0
        self.level_index = 0
        self.level_target = LEVELS[0]["target"]
        self.base_speed = LEVELS[0]["speed"]
        self.current_speed = self.base_speed
        self.clock_event = None
        self.is_running = False
        self.temp_speed_moves = 0
        self.temp_speed_value = None

        self._touch_start = None
        self._touch_end = None

        self.reset()
        self.bind(size=self._recalc, pos=self._recalc)

    def reset(self):
        self.level_index = 0
        self.score = 0
        self.direction = (1, 0)
        self.next_direction = (1, 0)
        self._apply_level(0, announce=False)

        cx, cy = self.cols // 2, self.rows // 2
        self.snake = deque([(cx, cy), (cx - 1, cy), (cx - 2, cy)])
        self._remove_snake_from_obstacles()
        self.spawn_food()
        self.on_score(self.score, self.level_target)
        self.on_level(self.level_index + 1, LEVELS[self.level_index]["name"])
        self._recalc()
        self.pause(show_status=True, message="Swipe to start")

    def _remove_snake_from_obstacles(self):
        self.obstacles = {p for p in self.obstacles if p not in self.snake}

    def _recalc(self, *args):
        pad = dp(12)
        usable_w = max(10, self.width - 2 * pad)
        usable_h = max(10, self.height - 2 * pad)
        self.cell = min(usable_w / self.cols, usable_h / self.rows)
        self.board_w = self.cell * self.cols
        self.board_h = self.cell * self.rows
        self.origin_x = self.x + (self.width - self.board_w) / 2
        self.origin_y = self.y + (self.height - self.board_h) / 2
        self._redraw()

    def _cell_rect(self, x, y, inset=0.08):
        size = self.cell * (1 - inset * 2)
        return (
            self.origin_x + x * self.cell + self.cell * inset,
            self.origin_y + y * self.cell + self.cell * inset,
            size,
            size,
        )

    def _redraw(self):
        self.canvas.clear()
        with self.canvas:
            Color(*COLORS["board"])
            RoundedRectangle(
                pos=(self.origin_x - dp(6), self.origin_y - dp(6)),
                size=(self.board_w + dp(12), self.board_h + dp(12)),
                radius=[dp(16)],
            )
            Color(*COLORS["board_border"])
            Line(
                rounded_rectangle=(
                    self.origin_x - dp(6),
                    self.origin_y - dp(6),
                    self.board_w + dp(12),
                    self.board_h + dp(12),
                    dp(16),
                ),
                width=1.2,
            )

            Color(*COLORS["grid"])
            step = 2
            for x in range(0, self.cols, step):
                x_pos = self.origin_x + x * self.cell
                Line(points=[x_pos, self.origin_y, x_pos, self.origin_y + self.board_h])
            for y in range(0, self.rows, step):
                y_pos = self.origin_y + y * self.cell
                Line(points=[self.origin_x, y_pos, self.origin_x + self.board_w, y_pos])

            for (x, y) in self.obstacles:
                Color(*COLORS["obstacle"], 0.9)
                rect = self._cell_rect(x, y, inset=0.12)
                RoundedRectangle(pos=rect[:2], size=rect[2:], radius=[dp(6)])

            if self.food:
                fx, fy = self.food
                glow_color = COLORS["food"]
                if self.food_type == "boost":
                    glow_color = COLORS["food_boost"]
                elif self.food_type == "slow":
                    glow_color = COLORS["food_slow"]
                Color(glow_color[0], glow_color[1], glow_color[2], 0.35)
                Ellipse(
                    pos=(
                        self.origin_x + fx * self.cell - self.cell * 0.1,
                        self.origin_y + fy * self.cell - self.cell * 0.1,
                    ),
                    size=(self.cell * 1.2, self.cell * 1.2),
                )
                Color(*glow_color)
                rect = self._cell_rect(fx, fy, inset=0.2)
                Ellipse(pos=rect[:2], size=rect[2:])

            for idx, (x, y) in enumerate(self.snake):
                if idx == 0:
                    Color(*COLORS["snake_head"])
                else:
                    Color(*COLORS["snake"], 0.9)
                rect = self._cell_rect(x, y, inset=0.12)
                RoundedRectangle(pos=rect[:2], size=rect[2:], radius=[dp(8)])

    def on_touch_down(self, touch):
        self._touch_start = touch.pos
        return super().on_touch_down(touch)

    def on_touch_up(self, touch):
        if self._touch_start is None:
            return super().on_touch_up(touch)
        dx = touch.x - self._touch_start[0]
        dy = touch.y - self._touch_start[1]
        threshold = dp(35)
        if abs(dx) > abs(dy) and abs(dx) > threshold:
            if dx > 0:
                self.set_direction(1, 0)
            else:
                self.set_direction(-1, 0)
        elif abs(dy) > threshold:
            self.set_direction(0, 1 if dy > 0 else -1)
        self._touch_start = None
        return super().on_touch_up(touch)

    def set_direction(self, x, y):
        direction = (x, y)
        if direction == (0, 0):
            return
        if (direction[0] == -self.direction[0] and direction[1] == -self.direction[1]):
            return
        self.next_direction = direction
        if not self.is_running:
            self.start()

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.on_status("", False)
        self._schedule()

    def pause(self, show_status=False, message="Paused"):
        self.is_running = False
        if self.clock_event is not None:
            self.clock_event.cancel()
            self.clock_event = None
        if show_status:
            self.on_status(message, True)

    def toggle_pause(self):
        if self.is_running:
            self.pause(show_status=True)
        else:
            self.start()

    def _schedule(self):
        if self.clock_event is not None:
            self.clock_event.cancel()
        self.clock_event = Clock.schedule_interval(self.step, self.current_speed)

    def _set_speed(self, speed):
        self.current_speed = max(MIN_SPEED, speed)
        if self.is_running:
            self._schedule()

    def _apply_level(self, index, announce=True):
        self.level_index = index
        if index < len(LEVELS):
            level = LEVELS[index]
            self.level_target = level["target"]
            self.base_speed = level["speed"]
            self.current_speed = self.base_speed
        else:
            overflow = index - len(LEVELS) + 1
            last = LEVELS[-1]
            self.level_target = last["target"] + overflow * 200
            self.base_speed = max(MIN_SPEED, last["speed"] - overflow * 0.01)
            self.current_speed = self.base_speed

        self.obstacles = build_obstacles(index + 1, self.cols, self.rows)
        self._remove_snake_from_obstacles()
        self._set_speed(self.base_speed)
        if announce:
            self.on_level(self.level_index + 1, LEVELS[min(index, len(LEVELS) - 1)]["name"])
            self._announce_level()

    def _announce_level(self):
        self.on_status(f"Level {self.level_index + 1}", True)
        anim = Animation(opacity=1, duration=0.2) + Animation(opacity=0, duration=1.0)
        anim.bind(on_complete=lambda *args: self.on_status("", False))
        if hasattr(self, "status_widget") and self.status_widget is not None:
            anim.start(self.status_widget)

    def spawn_food(self):
        free = []
        for x in range(self.cols):
            for y in range(self.rows):
                pos = (x, y)
                if pos in self.snake or pos in self.obstacles:
                    continue
                free.append(pos)
        if not free:
            self.pause(show_status=True, message="You win")
            return
        self.food = random.choice(free)
        roll = random.random()
        if roll > 0.9:
            self.food_type = "boost"
        elif roll > 0.8:
            self.food_type = "slow"
        else:
            self.food_type = "normal"

    def _apply_food_effect(self):
        extra_growth = 0
        if self.food_type == "boost":
            self.score += 25
            extra_growth = 1
            self.temp_speed_moves = 12
            self.temp_speed_value = self.base_speed * 0.75
            self._set_speed(self.temp_speed_value)
        elif self.food_type == "slow":
            self.score += 8
            self.temp_speed_moves = 10
            self.temp_speed_value = self.base_speed * 1.2
            self._set_speed(self.temp_speed_value)
        else:
            self.score += 12
        return extra_growth

    def _check_level_up(self):
        if self.score >= self.level_target:
            self._apply_level(self.level_index + 1)
            self.on_score(self.score, self.level_target)

    def step(self, dt):
        if not self.is_running:
            return
        self.direction = self.next_direction
        head_x, head_y = self.snake[0]
        new_head = (head_x + self.direction[0], head_y + self.direction[1])

        if not (0 <= new_head[0] < self.cols and 0 <= new_head[1] < self.rows):
            self.game_over()
            return
        if new_head in self.snake or new_head in self.obstacles:
            self.game_over()
            return

        self.snake.appendleft(new_head)
        if new_head == self.food:
            extra_growth = self._apply_food_effect()
            for _ in range(extra_growth):
                self.snake.append(self.snake[-1])
            self.spawn_food()
            self.on_score(self.score, self.level_target)
            self._check_level_up()
        else:
            self.snake.pop()

        if self.temp_speed_moves > 0:
            self.temp_speed_moves -= 1
            if self.temp_speed_moves == 0:
                self._set_speed(self.base_speed)

        self._redraw()

    def game_over(self):
        self.pause(show_status=True, message="Game Over")
        self.on_high_score(self.score)


class SnakeApp(App):
    def build(self):
        self.title = "Neon Serpent"
        self.store = JsonStore(os.path.join(self.user_data_dir, "snake_store.json"))
        self.high_score = self.store.get("score").get("high", 0) if self.store.exists("score") else 0

        root = BoxLayout(orientation="vertical", padding=dp(18), spacing=dp(14))

        header = BoxLayout(size_hint_y=None, height=dp(62), spacing=dp(12))
        self.score_label = Label(text="Score 0", font_size="22sp", color=COLORS["accent"])
        self.level_label = Label(text="Level 1", font_size="20sp", color=(0.9, 0.95, 1, 0.9))
        self.high_label = Label(text=f"Best {self.high_score}", font_size="18sp", color=(0.8, 0.85, 0.95, 0.85))
        header.add_widget(self.score_label)
        header.add_widget(self.level_label)
        header.add_widget(self.high_label)

        board_container = FloatLayout(size_hint_y=0.68)
        self.status_label = Label(
            text="",
            font_size="34sp",
            color=(1, 1, 1, 0.95),
            opacity=0,
        )

        self.board = GameBoard(
            on_score=self.update_score,
            on_level=self.update_level,
            on_status=self.update_status,
            on_high_score=self.update_high_score,
        )
        self.board.status_widget = self.status_label
        board_container.add_widget(self.board)
        board_container.add_widget(self.status_label)

        controls = BoxLayout(size_hint_y=None, height=dp(140), spacing=dp(12))
        control_left = BoxLayout(orientation="vertical", spacing=dp(10))
        control_right = BoxLayout(orientation="vertical", spacing=dp(10))

        self.pause_btn = Button(
            text="Pause",
            font_size="18sp",
            background_normal="",
            background_color=(0.25, 0.30, 0.36, 0.9),
            color=(1, 1, 1, 1),
        )
        self.pause_btn.bind(on_release=self.toggle_pause)

        restart_btn = Button(
            text="Restart",
            font_size="18sp",
            background_normal="",
            background_color=(0.85, 0.45, 0.25, 0.95),
            color=(1, 1, 1, 1),
        )
        restart_btn.bind(on_release=self.restart)

        control_left.add_widget(self.pause_btn)
        control_left.add_widget(restart_btn)

        dpad = BoxLayout(orientation="vertical", spacing=dp(6))
        up = Button(text="UP", font_size="16sp", background_normal="", background_color=(0.22, 0.27, 0.35, 0.9))
        mid = BoxLayout(spacing=dp(6))
        left = Button(text="LEFT", font_size="16sp", background_normal="", background_color=(0.22, 0.27, 0.35, 0.9))
        right = Button(text="RIGHT", font_size="16sp", background_normal="", background_color=(0.22, 0.27, 0.35, 0.9))
        down = Button(text="DOWN", font_size="16sp", background_normal="", background_color=(0.22, 0.27, 0.35, 0.9))
        mid.add_widget(left)
        mid.add_widget(right)
        dpad.add_widget(up)
        dpad.add_widget(mid)
        dpad.add_widget(down)

        up.bind(on_release=lambda *_: self.board.set_direction(0, 1))
        down.bind(on_release=lambda *_: self.board.set_direction(0, -1))
        left.bind(on_release=lambda *_: self.board.set_direction(-1, 0))
        right.bind(on_release=lambda *_: self.board.set_direction(1, 0))

        control_right.add_widget(dpad)

        controls.add_widget(control_left)
        controls.add_widget(control_right)

        root.add_widget(header)
        root.add_widget(board_container)
        root.add_widget(controls)

        with root.canvas.before:
            Color(*COLORS["bg_bottom"])
            Rectangle(pos=root.pos, size=root.size)
            Color(*COLORS["bg_top"])
            Rectangle(pos=(root.x, root.y + root.height * 0.45), size=(root.width, root.height * 0.55))

        root.bind(pos=self._update_bg, size=self._update_bg)
        return root

    def _update_bg(self, *args):
        root = self.root
        root.canvas.before.clear()
        with root.canvas.before:
            Color(*COLORS["bg_bottom"])
            Rectangle(pos=root.pos, size=root.size)
            Color(*COLORS["bg_top"])
            Rectangle(pos=(root.x, root.y + root.height * 0.45), size=(root.width, root.height * 0.55))

    def update_score(self, score, target):
        self.score_label.text = f"Score {score} / {target}"

    def update_level(self, level, name):
        self.level_label.text = f"Level {level} - {name}"

    def update_status(self, text, visible):
        self.status_label.text = text
        self.status_label.opacity = 1 if visible else 0

    def update_high_score(self, score):
        if score > self.high_score:
            self.high_score = score
            self.high_label.text = f"Best {self.high_score}"
            self.store.put("score", high=self.high_score)

    def toggle_pause(self, *_):
        self.board.toggle_pause()
        self.pause_btn.text = "Resume" if not self.board.is_running else "Pause"

    def restart(self, *_):
        self.board.reset()
        self.pause_btn.text = "Pause"


if __name__ == "__main__":
    SnakeApp().run()
