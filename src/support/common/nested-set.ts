import {
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
} from 'typeorm';

export function buildTree(rows) {
  const byId: any = new Map(
    rows
      .sort((a, b) => a.lft - b.lft)
      .map((el) => [el.id, { ...el, children: [] }]),
  );

  const roots: any[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createNodeTree(repository, item) {
  if (item.parentId) {
    const parent = await repository.findOneBy({ id: item.parentId });
    if (parent) {
      await repository.update(item.id, {
        lft: parent.rgt,
        rgt: parent.rgt + 1,
      });
      await repository.increment(
        { lft: MoreThan(parent.rgt), id: Not(item.id) },
        'lft',
        2,
      );
      await repository.increment(
        { rgt: MoreThanOrEqual(parent.rgt), id: Not(item.id) },
        'rgt',
        2,
      );
      return;
    }
  }
  const last = await repository.findOne({
    where: {},
    order: {
      rgt: 'desc',
    },
  });
  await repository.update(item.id, {
    parentId: null,
    lft: last ? last.rgt + 1 : 1,
    rgt: last ? last.rgt + 2 : 2,
  });
}

export async function deleteNodeTree(repository, item) {
  await repository.delete({
    lft: MoreThan(item.lft),
    rgt: LessThan(item.rgt),
  });
  await repository.decrement(
    { lft: MoreThan(item.lft) },
    'lft',
    item.rgt - item.lft + 1,
  );
  await repository.decrement(
    { rgt: MoreThan(item.rgt) },
    'rgt',
    item.rgt - item.lft + 1,
  );
}

export async function sortNodeTree(repository, parentId, itemIds) {
  let rgt = 0;
  let rgtUpdate = 0;
  if (parentId) {
    const parent = await repository.findOneBy({ id: parentId });
    if (parent) {
      rgt = parent.lft;
      rgtUpdate = parent.rgt;
    }
  }
  const last = await repository.findOne({
    where: {},
    order: {
      rgt: 'desc',
    },
  });
  if (!last) {
    return;
  }

  await repository
    .createQueryBuilder()
    .update()
    .set({
      lft: () => `lft + ${last.lft + 1}`,
      rgt: () => `rgt + ${last.lft + 1}`,
    })
    .where({
      lft: MoreThan(rgt),
      rgt: LessThan(rgtUpdate || last.rgt + 1),
    })
    .execute();

  for (const itemId of itemIds) {
    const item = await repository.findOneBy({ id: itemId });
    if (!item) {
      continue;
    }
    await repository
      .createQueryBuilder()
      .update()
      .set({
        lft: () => `lft + ${rgt - item.lft + 1}`,
        rgt: () => `rgt + ${rgt - item.lft + 1}`,
      })
      .where('lft >= :lft and rgt <= :rgt', { lft: item.lft, rgt: item.rgt })
      .execute();
    rgt = item.rgt + rgt - item.lft + 1;
  }
}
