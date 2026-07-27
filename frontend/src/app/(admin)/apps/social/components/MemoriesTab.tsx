import { useEffect, useState } from 'react'
import { TabPane } from 'react-bootstrap'

import { getMemoriesFeedPosts } from '@/helpers/data'
import type { SocialPostType } from '@/types/data'
import PostCard from './PostCard'

const MemoriesTab = () => {
  const [memoriesPosts, setMemoriesPosts] = useState<SocialPostType[]>()

  useEffect(() => {
    const fetchMemoriesPosts = async () => {
      const posts = await getMemoriesFeedPosts()
      if (posts) setMemoriesPosts(posts)
    }
    fetchMemoriesPosts()
  }, [])

  return (
    <TabPane eventKey="Memories" className="fade">
      {memoriesPosts ? (
        memoriesPosts.map((post) => <PostCard key={post.id} {...post} memories />)
      ) : (
        <h4 className="text-center ">Loading old posts...</h4>
      )}
    </TabPane>
  )
}

export default MemoriesTab
