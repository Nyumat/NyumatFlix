import { useRouter } from 'next/router';

const SearchResults = () => {
      const router = useRouter();
      const { search } = router.query;
      console.log(search);
      return (
            <div>
                  <h1>Search Results</h1>
                  {search}
            </div>
      );
};

export async function getServerSideProps(context: any) {
      const { search } = context.query;
      console.log(search);
}