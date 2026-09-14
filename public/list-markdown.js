/**
 * @param {ShoppingListData} list
 * @returns {string}
 */
export function listToMarkdown(list) {
  const sections = [`# ${list.title}`]

  for (const category of list.categories) {
    sections.push(`## ${category.name}`)
    sections.push(
      category.items.map(item => `- [${item.checked ? 'x' : ' '}] ${item.name}`).join('\n'),
    )
  }

  return sections.join('\n\n')
}
