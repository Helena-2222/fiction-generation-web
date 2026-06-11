from __future__ import annotations

from dataclasses import dataclass, field

from app.image_models import AssetRecord, TaskResponse


@dataclass
class InMemoryImageStore:
    tasks: dict[str, TaskResponse] = field(default_factory=dict)
    assets: dict[str, AssetRecord] = field(default_factory=dict)

    def create_task(self, task: TaskResponse) -> None:
        self.tasks[task.task_id] = task

    def update_task(self, task_id: str, **changes) -> TaskResponse | None:
        task = self.tasks.get(task_id)
        if not task:
            return None
        updated = task.model_copy(update=changes)
        self.tasks[task_id] = updated
        return updated

    def get_task(self, task_id: str) -> TaskResponse | None:
        return self.tasks.get(task_id)

    def add_asset(self, asset: AssetRecord) -> None:
        self.assets[asset.asset_id] = asset

    def get_asset(self, asset_id: str) -> AssetRecord | None:
        return self.assets.get(asset_id)

    def list_project_assets(self, project_id: str) -> list[AssetRecord]:
        return [asset for asset in self.assets.values() if asset.project_id == project_id]


image_store = InMemoryImageStore()
