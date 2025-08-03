import { GamePresenter, type CalcYakuFn } from '../ui/GamePresenter';

// Backward-compatible thin wrapper to preserve external API while migrating to Presenter.
// It delegates to GamePresenter (View/Controller) which uses a pure Engine (Model).
export class MahjongGame {
  private presenter: GamePresenter;

  constructor(opts: { calcYaku: CalcYakuFn }) {
    this.presenter = new GamePresenter({
      calcYaku: opts.calcYaku,
      debugPreloadedYaku: true,
    });
  }
}
